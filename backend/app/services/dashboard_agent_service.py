import json
import re
from typing import List, Dict, Any, Optional
import sqlglot
from sqlglot import exp
from app.core.config import settings
from app.core.logging import logger
from app.schemas.dashboard import PlanningResponse, DashboardPlan, DashboardMetric, DashboardVisualization
from app.agents.tools import get_semantic_model, execute_analytical_query

# Google ADK imports (optional for deployments that disable ADK/local-only mode)
try:
    from google.adk import Agent
    from google.adk.models import Gemini
    from google.adk.tools import FunctionTool
    ADK_AVAILABLE = True
except ImportError:
    Agent = None  # type: ignore[assignment]
    Gemini = None  # type: ignore[assignment]
    FunctionTool = None  # type: ignore[assignment]
    ADK_AVAILABLE = False


def _build_schema_context() -> str:
    """Build compact schema description from DuckDB for LLM prompts."""
    from app.services.duckdb_manager import duckdb_manager

    try:
        tables = duckdb_manager.execute(
            "SELECT table_schema, table_name "
            "FROM information_schema.tables "
            "WHERE table_schema NOT IN ('information_schema', 'pg_catalog') "
            "AND table_name NOT LIKE '_dlt_%' "
            "AND table_schema NOT LIKE '%_staging' "
            "ORDER BY table_schema, table_name"
        )
        if not tables:
            return "No synced data sources are available yet."

        columns = duckdb_manager.execute(
            "SELECT table_schema, table_name, column_name, data_type "
            "FROM information_schema.columns "
            "WHERE table_schema NOT IN ('information_schema', 'pg_catalog') "
            "AND table_name NOT LIKE '_dlt_%' "
            "AND table_schema NOT LIKE '%_staging' "
            "AND column_name NOT LIKE '_dlt_%' "
            "ORDER BY table_schema, table_name, ordinal_position"
        )

        col_map: Dict[str, List[str]] = {}
        for c in columns:
            key = f'{c["table_schema"]}.{c["table_name"]}'
            col_map.setdefault(key, []).append(f'{c["column_name"]} ({c["data_type"]})')

        lines = []
        for t in tables:
            schema = t["table_schema"]
            tname = t["table_name"]
            fqn = f'"{schema}"."{tname}"'
            cols = col_map.get(f"{schema}.{tname}", [])
            lines.append(f"Table {fqn}: {', '.join(cols)}")

        return "\n".join(lines)
    except Exception as e:
        logger.error(f"Failed to build schema context: {e}")
        return "Schema context unavailable."


PLANNING_PROMPT = """You are an expert dashboard planning assistant for a DuckDB-based BI tool.
You build rich, comprehensive dashboards that impress users with depth and insight.

## Available Data
{schema_context}

## User Request
{query}

## Instructions
Analyze ALL available data sources and the user's request. Automatically discover every relevant table and column — do NOT require the user to specify data sources manually.

Respond with a JSON object (no markdown, just raw JSON) with this exact structure:

{{
  "title": "Dashboard title",
  "metrics": [
    {{"name": "Metric Name", "aggregation": "sum|avg|count|min|max|none", "sql_column": "column_name"}}
  ],
  "dimensions": ["column1", "column2"],
  "time_range": "All time",
  "visualizations": [
    {{"type": "bar|line|area|number|table|donut", "metrics": ["Metric Name"], "breakdown": "dimension_or_null"}}
  ]
}}

## Rules
- Use ONLY tables and columns from the available data above.
- Scan ALL tables for relevant data — pull metrics from every relevant source.
- Create **6-12 visualizations** for a comprehensive dashboard. More is better for complex requests.
- Mix visualization types for variety:
  * "number" for headline KPIs (revenue, total count, averages) — use 3-5 of these
  * "donut" for breakdowns/proportions (category splits, status distributions)
  * "bar" for comparisons across categories
  * "line" or "area" for trends over time
  * "table" for detailed data views
- Each metric should appear in exactly ONE visualization.
- For KPI/number widgets, use a SINGLE metric per visualization.
- For chart widgets, you may combine 1-3 related metrics.
- If the request mentions "KPIs" or "lots of metrics", generate at least 4-5 number-type widgets.
- If the request is too vague AND no data is available, respond with: {{"clarify": "Your question here"}}
- If data IS available, always try to build a dashboard — be proactive, not conservative.
"""


WIDGET_SQL_PROMPT = """You are a DuckDB SQL expert. Generate a read-only SQL query for a dashboard widget.

## Available Data
{schema_context}

## Widget Requirements
- Type: {viz_type}
- Metrics: {metrics}
- Breakdown: {breakdown}
- Aggregations: {aggregations}

## Rules
1. ALWAYS use fully schema-qualified table names with double quotes: "schema"."table"
2. Use DuckDB SQL syntax
3. Return ONLY the raw SQL query, no markdown, no explanation
4. Use LIMIT 50
5. For "number" widgets, return a single aggregated value
6. For chart widgets, GROUP BY the breakdown dimension
"""


class DashboardAgentService:
    def __init__(self):
        self.adk_enabled = settings.AI_PROVIDER == "gemini" and ADK_AVAILABLE
        self.model = None
        self.sql_model = None
        if self.adk_enabled:
            self.model = Gemini(model=settings.LLM_MODEL, temperature=0.2)
            self.sql_model = Gemini(model=settings.LLM_MODEL, temperature=0.1)
        else:
            if settings.AI_PROVIDER == "gemini" and not ADK_AVAILABLE:
                logger.warning(
                    "google.adk is not installed. Dashboard ADK path is disabled; "
                    "falling back to direct provider."
                )
            logger.info("DashboardAgentService running with direct provider fallback.")

    @staticmethod
    def _is_read_only_sql(sql: str) -> bool:
        try:
            parsed = sqlglot.parse(sql, read="duckdb")
            if not parsed:
                return False
            dangerous = (
                exp.Delete, exp.Update, exp.Drop, exp.TruncateTable,
                exp.Insert, exp.Alter, exp.Create,
            )
            for statement in parsed:
                if isinstance(statement, dangerous):
                    return False
                for node in statement.walk():
                    if isinstance(node, dangerous):
                        return False
            return True
        except Exception:
            sql_upper = sql.upper().strip()
            if not (sql_upper.startswith("SELECT") or sql_upper.startswith("WITH")):
                return False
            return not any(
                keyword in sql_upper
                for keyword in ["DELETE ", "DROP ", "UPDATE ", "INSERT ", "TRUNCATE ", "ALTER ", "CREATE "]
            )

    async def _local_plan_dashboard(self, query: str, history: List[Dict[str, str]], connection_ids: Optional[List[str]] = None) -> PlanningResponse:
        """Plan a dashboard using the local/ollama LLM provider."""
        from app.services.llm_provider_service import llm_provider_registry

        schema_context = _build_schema_context()
        prompt = PLANNING_PROMPT.format(schema_context=schema_context, query=query)

        provider = llm_provider_registry.get_provider()
        raw = await provider.generate(prompt=prompt, config={"temperature": 0.2})

        # Extract JSON from response
        raw = raw.strip()
        json_match = re.search(r"```(?:json)?\s*\n?([\s\S]*?)```", raw)
        if json_match:
            raw = json_match.group(1).strip()

        try:
            plan_data = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning(f"Dashboard planning: could not parse JSON from LLM response: {raw[:200]}")
            return PlanningResponse(
                status="clarifying",
                question="I couldn't generate a valid plan. Could you be more specific about what metrics and visualizations you want?",
            )

        if "clarify" in plan_data:
            return PlanningResponse(status="clarifying", question=plan_data["clarify"])

        try:
            plan = DashboardPlan(**plan_data)
            return PlanningResponse(status="ready", plan=plan)
        except Exception as e:
            logger.warning(f"Dashboard plan validation failed: {e}")
            return PlanningResponse(
                status="clarifying",
                question=f"I generated a plan but it had structural issues. Could you be more specific? Error: {e}",
            )

    async def plan_dashboard(self, query: str, history: List[Dict[str, str]], user_id: str, connection_ids: Optional[List[str]] = None) -> PlanningResponse:
        """Plan a dashboard using ADK or direct provider fallback."""
        try:
            if not self.adk_enabled:
                return await self._local_plan_dashboard(query, history, connection_ids)

            plan_capturer = {"result": None}

            def submit_dashboard_plan(status: str, question: str, plan: Dict[str, Any] = None):
                plan_capturer["result"] = PlanningResponse(
                    status=status,
                    question=question,
                    plan=DashboardPlan(**plan) if plan else None
                )
                return "Plan submitted successfully."

            def get_scoped_semantic_model():
                return get_semantic_model(connection_ids=connection_ids)

            tools = [
                FunctionTool(get_scoped_semantic_model),
                FunctionTool(submit_dashboard_plan)
            ]

            agent = Agent(
                name="DashboardPlanner",
                model=self.model,
                tools=tools,
                instruction="""
                You are an expert Dashboard Planning Agent for Kuantra.
                1. Call `get_scoped_semantic_model()` to inspect the available data.
                2. If the user's request is vague, call `submit_dashboard_plan(status='clarifying', question=...)`.
                3. If request is clear, design a dashboard with 3-6 widgets and call `submit_dashboard_plan(status='ready', plan=...)`.
                """
            )

            context_prompt = f"History: {json.dumps(history)}\nUser Request: {query}"
            async for _ in agent.run_async(context_prompt):
                pass

            if plan_capturer["result"]:
                return plan_capturer["result"]

            return PlanningResponse(status="clarifying", question="I couldn't generate a valid plan. Could you be more specific?")

        except Exception as e:
            logger.error(f"Dashboard planning failed: {e}")
            return PlanningResponse(status="clarifying", question=f"Error planning dashboard: {str(e)}")

    async def _local_generate_widget_sql(self, viz: Any, aggregations: Optional[Dict[str, str]] = None) -> str:
        """Generate SQL for a widget using local/ollama provider."""
        from app.services.llm_provider_service import llm_provider_registry

        schema_context = _build_schema_context()
        prompt = WIDGET_SQL_PROMPT.format(
            schema_context=schema_context,
            viz_type=viz.type,
            metrics=", ".join(viz.metrics),
            breakdown=viz.breakdown or "none",
            aggregations=json.dumps(aggregations or {}),
        )

        provider = llm_provider_registry.get_provider()
        raw = await provider.generate(prompt=prompt, config={"temperature": 0.1})

        raw = raw.strip()
        sql_match = re.search(r"```(?:sql)?\s*\n?([\s\S]*?)```", raw)
        if sql_match:
            return sql_match.group(1).strip()
        if raw.upper().lstrip().startswith(("SELECT ", "WITH ")):
            return raw
        return raw

    async def generate_widget_data(
        self,
        viz: Any,
        user_id: str,
        aggregations: Optional[Dict[str, str]] = None,
        connection_ids: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Generate SQL for a visualization and execute it."""
        try:
            if not self.adk_enabled:
                sql_query = await self._local_generate_widget_sql(viz, aggregations)
            else:
                sql_capturer = {"sql": None}

                def submit_sql_query(sql: str, connection_id: Optional[str] = None):
                    sql_capturer["sql"] = sql
                    return "SQL captured."

                def get_scoped_semantic_model():
                    return get_semantic_model(connection_ids=connection_ids)

                agent = Agent(
                    name="SQLGenerator",
                    model=self.sql_model,
                    tools=[
                        FunctionTool(get_scoped_semantic_model),
                        FunctionTool(submit_sql_query)
                    ],
                    instruction="""
                    You are a DuckDB SQL expert. Generate a read-only SQL query for a dashboard widget.
                    1. Check `get_scoped_semantic_model` to find tables and columns.
                    2. Write a SQL query matching the widget requirements.
                    3. Use schema-qualified table names.
                    4. Return SELECT/WITH query only.
                    5. Call `submit_sql_query` with the SQL.
                    """
                )

                prompt = f"""
                Widget: metrics={viz.metrics}, type={viz.type}, breakdown={viz.breakdown},
                aggregations={aggregations}, connection_ids={connection_ids}.
                Generate DuckDB SQL. Limit 50 rows.
                """

                async for _ in agent.run_async(prompt):
                    pass

                if not sql_capturer["sql"]:
                    return {"data": [], "index": "error", "categories": [], "sql": "-- No SQL generated", "error": "No SQL generated"}

                sql_query = sql_capturer["sql"]

            if not sql_query or not sql_query.strip():
                return {"data": [], "index": "error", "categories": [], "sql": "", "error": "No SQL generated"}

            if not self._is_read_only_sql(sql_query):
                return {
                    "data": [], "index": "error", "categories": [],
                    "sql": sql_query, "error": "Generated SQL was not read-only and was blocked.",
                }

            results = execute_analytical_query(
                sql_query,
                connection_ids=connection_ids,
                timeout_s=settings.ANALYTICAL_QUERY_TIMEOUT_SECONDS,
            )

            if isinstance(results, str):
                return {"data": [], "index": "error", "categories": [], "sql": sql_query, "error": results}

            if results:
                keys = list(results[0].keys())
                index_key = keys[0]
                return {
                    "data": results,
                    "index": index_key,
                    "categories": [k for k in keys if k != index_key],
                    "sql": sql_query
                }

            return {"data": [], "index": "x", "categories": [], "sql": sql_query}

        except Exception as e:
            logger.error(f"Widget generation failed: {e}")
            return {"data": [], "index": "error", "categories": [], "sql": "", "error": str(e)}

dashboard_agent_service = DashboardAgentService()
