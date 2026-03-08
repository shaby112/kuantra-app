from google.adk.agents import LlmAgent
from google.adk.tools import FunctionTool
from app.semantic.wren_client import WrenClient
from app.core.logging import logger
from typing import Dict, Any

wren_client = WrenClient()

def query_semantic_layer_func(natural_language_query: str) -> Dict[str, Any]:
    """
    Translates a natural language question into SQL using the Semantic Layer (Wren) and executes it.
    Returns the query result.
    """
    import asyncio
    try:
        # Generate SQL
        sql = asyncio.run(wren_client.generate_sql(natural_language_query))
        
        # Execute SQL (using DuckDB Manager directly)
        from app.services.duckdb_manager import duckdb_manager
        result = duckdb_manager.execute(sql)
        
        return {
            "sql": sql,
            "data": result,
            "status": "success"
        }
    except Exception as e:
        logger.error(f"Semantic Query Failed: {e}")
        return {"error": str(e), "status": "failed"}

# Define Tool
semantic_query_tool = FunctionTool(
    name="query_semantic_layer",
    description="Ask a business question to get data. Handles joins and ambiguity automatically.",
    func=query_semantic_layer_func
)

def get_analyst_agent() -> LlmAgent:
    return LlmAgent(
        model="gemini-2.0-flash",
        name="Data Analyst",
        instruction="""
        You are an expert Data Analyst using a Semantic Layer.
        
        Your Goal: Answer user questions by querying the data warehouse.
        
        Capabilities:
        - You have access to a Semantic Layer that understands the data model (MDL).
        - You CANNOT write SQL directly. You MUST use `query_semantic_layer(question)` to get data.
        - If the user asks for a calculation (e.g. "ROI"), ask the semantic layer "Calculate ROI".
        - Verify column ambiguity by trusting the semantic layer's interpretation.
        
        Output:
        - Present the answer clearly.
        - If data is returned, summarize the key insight.
        """,
        tools=[semantic_query_tool]
    )
