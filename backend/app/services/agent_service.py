import json
import asyncio
from google import genai
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.logging import logger
from app.db.models import DbConnection
from app.utils.crypto import crypto_service
import asyncpg
from .file_query_service import FileQueryService
from .llm_provider_service import resolve_google_api_key

class AgentService:
    def __init__(self):
        self._client = None
        # Use settings for model ID
        self.model_id = settings.LLM_MODEL

    @property
    def client(self):
        if self._client is None:
            if settings.AI_PROVIDER != "gemini":
                raise RuntimeError(
                    "AgentService Gemini client is disabled when AI_PROVIDER is not 'gemini'."
                )
            logger.info(f"Initializing Gemini Client with model: {self.model_id}")
            self._client = genai.Client(api_key=resolve_google_api_key())
        return self._client

    async def execute_sql_tool(self, sql_query: str, connection_id: int) -> str:
        """
        Tool called by Gemini to execute SQL queries against a specific database.
        """
        logger.info(f"AI requested SQL execution on connection {connection_id}: {sql_query}")
        
        # 1. Safe Mode Check
        forbidden_keywords = ["UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "INSERT", "GRANT", "REVOKE"]
        upper_query = sql_query.upper()
        
        if any(keyword in upper_query for keyword in forbidden_keywords):
            logger.warning(f"BLOCKED forbidden query: {sql_query}")
            return "Error: This query contains forbidden keywords (UPDATE/DELETE/DROP). I can only perform SELECT queries in this mode."
        if not (upper_query.strip().startswith("SELECT") or upper_query.strip().startswith("WITH")):
            return "Error: Only read-only SELECT/WITH queries are allowed."

        safe_query = sql_query
        if " LIMIT " not in upper_query:
            safe_query = f"{sql_query.rstrip().rstrip(';')} LIMIT 100"

        try:
            async with AsyncSessionLocal() as db:
                # Get connection details
                conn_record = await db.get(DbConnection, connection_id)
                if not conn_record:
                    return f"Error: Connection ID {connection_id} not found."

                if conn_record.connection_type == "file":
                    result_data = FileQueryService.query_file(conn_record.file_path, safe_query)
                    logger.info(f"File query returned {len(result_data)} rows")
                    
                    if len(result_data) > 50:
                        result_data = result_data[:50]
                        return json.dumps(result_data, default=str) + "\n... (result truncated to 50 rows)"
                    
                    return json.dumps(result_data, default=str)

                # PostgreSQL / External DB logic
                if conn_record.connection_uri:
                    uri = conn_record.connection_uri
                else:
                    password = crypto_service.decrypt(conn_record.encrypted_password)
                    uri = f"postgresql://{conn_record.username}:{password}@{conn_record.host}:{conn_record.port}/{conn_record.database_name}"
                
                # Connect to external DB
                conn = await asyncpg.connect(uri, timeout=15, statement_cache_size=0)
                try:
                    rows = await asyncio.wait_for(
                        conn.fetch(safe_query),
                        timeout=settings.EXTERNAL_QUERY_TIMEOUT_SECONDS,
                    )
                    # Convert to list of dicts
                    result_data = [dict(row) for row in rows]
                    
                    logger.info(f"Query returned {len(result_data)} rows")
                    
                    # Limit result size for LLM context
                    if len(result_data) > 50:
                        result_data = result_data[:50]
                        return json.dumps(result_data, default=str) + "\n... (result truncated to 50 rows)"
                    
                    return json.dumps(result_data, default=str)
                finally:
                    await conn.close()

        except asyncio.TimeoutError:
            return f"Error: QUERY_TIMEOUT after {settings.EXTERNAL_QUERY_TIMEOUT_SECONDS}s"
        except Exception as e:
            logger.error(f"SQL Execution Error: {e}")
            return f"Error executing SQL: {str(e)}"

    async def stream_analysis(self, user_query: str, user_id: int, history: list = None):
        """
        Deprecated compatibility adapter.
        Delegates to ChatService so all chat flows share one semantic context path.
        
        Args:
            user_query: The current user message
            user_id: The user's ID for fetching schemas
            history: List of previous messages [{"role": "user/assistant", "content": "..."}]
        """
        from app.services.chat_service import chat_service

        try:
            result = await chat_service.process_message_async(user_query)
            yield {"type": "text", "content": result.get("content", "")}
        except Exception as e:
            logger.error(f"Agent adapter error: {e}")
            yield {"type": "error", "content": f"Analysis failed: {str(e)}"}

agent_service = AgentService()
