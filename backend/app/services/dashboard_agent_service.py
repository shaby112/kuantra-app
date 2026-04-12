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
    """Build compact schema description from DuckDB for LLM prompts.

    Uses plain table names — the auto-qualifier resolves schemas at execution.
    Validates each table is queryable before including it.
    Includes connection source names so the LLM can pick the right table.
    """
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

        # Build schema-to-connection-name map from PostgreSQL metadata
        schema_to_source: Dict[str, str] = {}
        try:
            from sqlalchemy import create_engine, text as sa_text
            sync_url = settings.DATABASE_URL.replace("+asyncpg", "").replace("+aiopg", "")
            _sync_eng = create_engine(sync_url, pool_pre_ping=True, pool_size=1)
            with _sync_eng.connect() as pg_conn:
                rows = pg_conn.execute(sa_text(
                    "SELECT id, name FROM connections"
                )).fetchall()
                for row in rows:
                    conn_id = str(row[0]).replace("-", "")
                    schema_to_source[f"conn_{conn_id}"] = row[1]
            _sync_eng.dispose()
        except Exception:
            pass

        # Verify which tables are actually queryable (file tables may have missing parquets)
        valid_tables = []
        for t in tables:
            schema = t["table_schema"]
            tname = t["table_name"]
            try:
                duckdb_manager.execute(
                    f'SELECT 1 FROM "{schema}"."{tname}" LIMIT 1'
                )
                valid_tables.append(t)
            except Exception:
                logger.debug(f"Skipping broken table {schema}.{tname}")

        if not valid_tables:
            return "No queryable data sources are available yet."

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
        for t in valid_tables:
            schema = t["table_schema"]
            tname = t["table_name"]
            key = f"{schema}.{tname}"
            cols = col_map.get(key, [])
            source = schema_to_source.get(schema, "")
            source_label = f" [source: {source}]" if source else ""
            lines.append(f"Table: {tname}{source_label}")
            for col_desc in cols:
                lines.append(f"  - {col_desc}")

        if valid_tables:
            example_table = valid_tables[0]["table_name"]
            lines.append(f'\nUse plain table names in SQL: SELECT * FROM {example_table} LIMIT 10')
            lines.append("IMPORTANT: Each column belongs ONLY to the table listed above it.")
            lines.append("Do NOT use a column from one table in a query on a different table.")

        return "\n".join(lines)
    except Exception as e:
        logger.error(f"Failed to build schema context: {e}")
        return "Schema context unavailable."


PLANNING_PROMPT = """You are a dashboard planning assistant for DuckDB. Respond with ONLY raw JSON, no markdown.

## Data
{schema_context}

## Request
{query}

## Output format
{{
  "title": "Dashboard title",
  "metrics": [
    {{"name": "Total Revenue", "aggregation": "sum", "sql_column": "total_amount"}},
    {{"name": "Order Count", "aggregation": "count", "sql_column": "id"}}
  ],
  "dimensions": ["region", "order_date"],
  "time_range": "All time",
  "visualizations": [
    {{"type": "number", "metrics": ["Total Revenue"], "breakdown": null}},
    {{"type": "bar", "metrics": ["Total Revenue"], "breakdown": "region"}}
  ]
}}

## Rules
- Use ONLY tables/columns from available data above
- Create 4-8 visualizations mixing types: 2-3 "number" KPIs, plus bar/line/donut/table
- Each metric in exactly ONE visualization
- sql_column must be actual column names from the data
- IMPORTANT: visualizations[].metrics is a list of PLAIN STRINGS (metric names), NOT objects
- If no data available and request is vague: {{"clarify": "question"}}
"""


WIDGET_SQL_PROMPT = """DuckDB SQL expert. Return ONLY raw SQL, no markdown.

Data: {schema_context}

Widget: type={viz_type}, metrics=[{metrics}], breakdown={breakdown}, aggregations={aggregations}

Rules:
- Use plain table names (no schema prefix). Do NOT use aliases like T1, T2 — use the actual table name.
- LIMIT 50 for charts, no LIMIT for single-value "number"/"metric" widgets.
- Charts: GROUP BY the breakdown dimension. Every non-aggregated column in SELECT MUST be in GROUP BY.
- When joining tables, prefix columns with the actual table name, NOT an alias.
- CRITICAL: Only SELECT columns that actually exist on the table you are querying. Check the column list above carefully. If a column is listed under Table A, do NOT use it in a query on Table B.
- If a metric name doesn't exactly match a column name, find the closest matching column from the correct table.
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
        raw = await provider.generate(prompt=prompt, config={"temperature": 0.2, "num_predict": 2048})

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

        # Coerce visualization metrics from objects to strings if needed
        for viz in plan_data.get("visualizations", []):
            if "metrics" in viz:
                viz["metrics"] = [
                    m["name"] if isinstance(m, dict) and "name" in m else str(m)
                    for m in viz["metrics"]
                ]

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

    async def _local_generate_all_widget_sql(
        self,
        visualizations: List[Any],
        all_aggregations: List[Dict[str, str]],
    ) -> List[str]:
        """Generate SQL for ALL widgets in a single LLM call (batch)."""
        from app.services.llm_provider_service import llm_provider_registry

        schema_context = _build_schema_context()

        widget_specs = []
        for i, (viz, aggs) in enumerate(zip(visualizations, all_aggregations)):
            widget_specs.append(
                f"Widget {i+1}: type={viz.type}, metrics=[{', '.join(viz.metrics)}], "
                f"breakdown={viz.breakdown or 'none'}, aggregations={json.dumps(aggs)}"
            )

        prompt = f"""DuckDB SQL expert. Generate SQL queries for dashboard widgets. Return ONLY a JSON array.

## Data
{schema_context}

## Widgets
{chr(10).join(widget_specs)}

## Rules
- Use plain table names (no schema prefix needed). Do NOT use aliases like T1, T2 — use the actual table name.
- LIMIT 50 for charts, no LIMIT for single-value "number"/"metric" widgets
- "number"/"metric" type: return single aggregated value (e.g., SELECT SUM(col) AS value FROM table)
- Charts: GROUP BY the breakdown dimension. Every non-aggregated column in SELECT MUST also appear in GROUP BY.
- When joining tables, prefix columns with the actual table name, NOT an alias.
- CRITICAL: Only SELECT columns that actually exist on the table you are querying. Check the column list above carefully. If a column is listed under Table A, do NOT use it in a query on Table B.
- If a metric name doesn't exactly match a column name, find the closest matching column from the correct table.

## Output
JSON array of SQL strings, one per widget. Example: ["SELECT SUM(x) FROM t1", "SELECT a, COUNT(*) FROM t2 GROUP BY a LIMIT 50"]
"""

        provider = llm_provider_registry.get_provider()
        raw = await provider.generate(prompt=prompt, config={"temperature": 0.1, "num_predict": 2048})

        raw = raw.strip()
        # Try to extract JSON array
        json_match = re.search(r"```(?:json)?\s*\n?([\s\S]*?)```", raw)
        if json_match:
            raw = json_match.group(1).strip()

        try:
            sql_list = json.loads(raw)
            if isinstance(sql_list, list):
                parsed = [str(s).strip() for s in sql_list]
                # Pad or truncate to match expected count
                while len(parsed) < len(visualizations):
                    parsed.append("")
                return parsed[:len(visualizations)]
        except json.JSONDecodeError:
            pass

        # Fallback: extract individual SQL statements from raw text
        logger.warning(f"Batch SQL generation didn't return valid JSON array: {raw[:200]}")
        # Try to find SELECT statements
        sql_statements = re.findall(r'((?:SELECT|WITH)\b[^;]*?)(?:;|\Z)', raw, re.IGNORECASE | re.DOTALL)
        if sql_statements and len(sql_statements) >= len(visualizations):
            return [s.strip() for s in sql_statements[:len(visualizations)]]

        # Last resort: individual calls
        logger.warning("Falling back to individual SQL generation calls")
        results = []
        for i, (viz, aggs) in enumerate(zip(visualizations, all_aggregations)):
            try:
                sql = await self._local_generate_widget_sql(viz, aggs)
                results.append(sql)
            except Exception as e:
                logger.error(f"Widget {i+1} SQL generation failed: {e}")
                results.append("")
        return results

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

    async def generate_all_widget_data_batch(
        self,
        visualizations: List[Any],
        all_aggregations: List[Dict[str, str]],
        user_id: str,
        connection_ids: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Generate SQL for all widgets in one LLM call, then execute each."""
        if not self.adk_enabled:
            sql_list = await self._local_generate_all_widget_sql(visualizations, all_aggregations)
        else:
            # ADK path: fall back to individual calls
            sql_list = []
            for viz, aggs in zip(visualizations, all_aggregations):
                result = await self.generate_widget_data(viz, user_id, aggs, connection_ids)
                sql_list.append(result.get("sql", ""))

            # For ADK, results are already complete — return early
            # (this won't actually be reached in the refactored flow)

        results = []
        for i, (viz, sql_query) in enumerate(zip(visualizations, sql_list)):
            try:
                if not sql_query or not sql_query.strip():
                    results.append({"data": [], "index": "error", "categories": [], "sql": "", "error": "No SQL generated"})
                    continue

                if not self._is_read_only_sql(sql_query):
                    results.append({
                        "data": [], "index": "error", "categories": [],
                        "sql": sql_query, "error": "Generated SQL was not read-only and was blocked.",
                    })
                    continue

                query_results = execute_analytical_query(
                    sql_query,
                    connection_ids=connection_ids,
                    timeout_s=settings.ANALYTICAL_QUERY_TIMEOUT_SECONDS,
                )

                if isinstance(query_results, str):
                    results.append({"data": [], "index": "error", "categories": [], "sql": sql_query, "error": query_results})
                elif query_results:
                    keys = list(query_results[0].keys())
                    index_key = keys[0]
                    results.append({
                        "data": query_results,
                        "index": index_key,
                        "categories": [k for k in keys if k != index_key],
                        "sql": sql_query,
                    })
                else:
                    results.append({"data": [], "index": "x", "categories": [], "sql": sql_query})

            except Exception as e:
                logger.error(f"Widget {i+1} execution failed: {e}")
                results.append({"data": [], "index": "error", "categories": [], "sql": sql_query if sql_query else "", "error": str(e)})

        return results


dashboard_agent_service = DashboardAgentService()
