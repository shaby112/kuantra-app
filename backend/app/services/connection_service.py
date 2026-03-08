import asyncio
import asyncpg
import sqlglot
from sqlglot import exp
from typing import List, Dict, Any, Optional
from app.db.models import DbConnection
from app.utils.crypto import crypto_service
from app.utils.identifiers import connection_schema_name
from app.core.config import settings
from app.core.logging import logger


class QueryTimeoutError(Exception):
    """Raised when query execution exceeds configured timeout."""


class ConnectionService:
    async def _get_pg_connection(self, conn: DbConnection, override_host: str = None, override_port: int = None):
        """Helper to create an asyncpg connection from a DbConnection model"""
        if conn.connection_uri:
            uri = conn.connection_uri
            password = None
            if conn.encrypted_password:
                password = crypto_service.decrypt(conn.encrypted_password)

            if override_host and override_port:
                # Rewrite URI to use tunnel
                from sqlalchemy.engine.url import make_url
                url = make_url(uri)
                # We keep the original credentials and DB name, but change host/port
                uri = f"postgresql://{url.username}:{url.password}@{override_host}:{override_port}/{url.database}"
            
            if "postgresql+asyncpg://" in uri:
                uri = uri.replace("postgresql+asyncpg://", "postgresql://")
            
            logger.info(f"Connecting to DB via URI (ID: {conn.id}) - Tunnel: {bool(override_host)}")
            
            return await asyncpg.connect(
                dsn=uri,
                password=password if password else None,
                statement_cache_size=0,
                ssl='require' if 'supabase' in uri and not override_host else None
            )

        host = override_host or conn.host
        port = override_port or conn.port
        
        logger.info(f"Connecting to DB via params (ID: {conn.id}, Host: {host}, Port: {port})")
        password = crypto_service.decrypt(conn.encrypted_password)
        return await asyncpg.connect(
            user=conn.username,
            password=password,
            database=conn.database_name,
            host=host,
            port=port,
            statement_cache_size=0,
            ssl='require' if 'supabase' in (conn.host or "") and not override_host else None
        )

    from contextlib import asynccontextmanager
    @asynccontextmanager
    async def _connection_context(self, conn_model: DbConnection):
        """Context manager to handle SSH tunnel and connection."""
        if conn_model.use_ssh_tunnel:
            if not conn_model.ssh_key_path:
                raise ValueError("SSH key is required for SSH tunneling")
                
            from app.utils.ssh_tunnel import get_ssh_tunnel
            logger.info(f"Establishing SSH tunnel for connection {conn_model.id}")
            
            # Establish tunnel (blocking call, but manageable for now)
            # Decrypt SSH parameters
            ssh_host = crypto_service.decrypt(conn_model.ssh_host)
            ssh_username = crypto_service.decrypt(conn_model.ssh_username)
            
            # Establish tunnel
            with get_ssh_tunnel(
                ssh_host=ssh_host,
                ssh_username=ssh_username,
                ssh_key_path=conn_model.ssh_key_path,
                remote_host=conn_model.host,
                remote_port=conn_model.port or 5432,
                ssh_port=conn_model.ssh_port or 22
            ) as (local_host, local_port):
                conn = await self._get_pg_connection(conn_model, override_host=local_host, override_port=local_port)
                try:
                    yield conn
                finally:
                    await conn.close()
        else:
            conn = await self._get_pg_connection(conn_model)
            try:
                yield conn
            finally:
                await conn.close()

    async def get_schema(self, conn_model: DbConnection) -> List[Dict[str, Any]]:
        """
        Connects to the external DB and fetches tables and columns.
        Returns a structured list of tables with their columns.
        """
        print(f"[DEBUG] connection_service.get_schema started for conn {conn_model.id}")
        try:
            # ---------------------------------------------------------
            # Check for cached data (DuckDB)
            # ---------------------------------------------------------
            if conn_model.sync_config and conn_model.sync_config.last_sync_status == "success":
                logger.info(f"Schema routing: Hit cache for connection {conn_model.id} (DuckDB)")
                from app.services.duckdb_manager import duckdb_manager
                
                dataset_name = connection_schema_name(conn_model.id)
                query = """
                    SELECT 
                        table_name, 
                        column_name, 
                        data_type
                    FROM 
                        information_schema.columns
                    WHERE 
                        table_schema = ?
                        AND table_name NOT LIKE '_dlt_%'
                    ORDER BY 
                        table_name, ordinal_position;
                """
                rows = duckdb_manager.execute(query, (dataset_name,))
                
                schema = {}
                for row in rows:
                    table = row["table_name"]
                    if table not in schema:
                        schema[table] = []
                    schema[table].append(
                        {"name": row["column_name"], "type": row["data_type"]}
                    )
                return [{"table": k, "columns": v} for k, v in schema.items()]

            # ---------------------------------------------------------
            # Fallback: Query External Source
            # ---------------------------------------------------------
            async with self._connection_context(conn_model) as conn:
                print(f"[DEBUG] connection established")
                # Query to get tables and columns from information_schema
                query = """
                    SELECT 
                        table_name, 
                        column_name, 
                        data_type
                    FROM 
                        information_schema.columns
                    WHERE 
                        table_schema = 'public'
                        AND table_name NOT LIKE '_dlt_%'
                    ORDER BY 
                        table_name, ordinal_position;
                """
                try:
                    rows = await asyncio.wait_for(
                        conn.fetch(query),
                        timeout=settings.EXTERNAL_QUERY_TIMEOUT_SECONDS,
                    )
                except asyncio.TimeoutError as exc:
                    raise QueryTimeoutError(
                        f"Schema fetch timed out after {settings.EXTERNAL_QUERY_TIMEOUT_SECONDS}s"
                    ) from exc

                # Transform into a nested structure
                schema = {}
                for row in rows:
                    table = row["table_name"]
                    if table not in schema:
                        schema[table] = []
                    schema[table].append(
                        {"name": row["column_name"], "type": row["data_type"]}
                    )

                return [{"table": k, "columns": v} for k, v in schema.items()]
        except Exception as e:
            msg = f"SCHEMA_FETCH_ERROR on connection {conn_model.id}: {type(e).__name__} - {str(e)}"
            logger.error(msg, exc_info=True)
            print(f"[DEBUG] !! ERROR in get_schema: {msg}")
            raise Exception(msg)

    def is_safe_query(self, sql: str) -> bool:
        """
        Checks if the query is safe (read-only) using sqlglot.
        Returns True if safe, False otherwise.
        """
        try:
            # Specify postgres dialect for better parsing
            parsed_list = sqlglot.parse(sql, read="postgres")
            if not parsed_list:
                return False
            
            dangerous_types = (
                exp.Delete,
                exp.Update,
                exp.Drop,
                exp.TruncateTable,
                exp.Insert,
                exp.Alter,
                exp.Create,
            )

            for parsed in parsed_list:
                if isinstance(parsed, dangerous_types):
                    return False

                # Check sub-expressions
                for node in parsed.walk():
                    if isinstance(node, dangerous_types):
                        return False

            return True
        except Exception as e:
            # If it starts with SELECT and parsing fails, we might want to allow it?
            # But let's stay safe. However, let's log the error.
            print(f"SQL check error: {e}")
            # fall back to a simpler string check if sqlglot fails
            sql_upper = sql.upper().strip()
            if sql_upper.startswith("SELECT") and not any(x in sql_upper for x in ["DELETE ", "DROP ", "UPDATE ", "INSERT ", "TRUNCATE ", "ALTER "]):
                return True
            return False

    def optimize_query(self, sql: str) -> str:
        """
        Parses the query and adds LIMIT 1000 if it's a SELECT statement and has no limit.
        """
        try:
            parsed = sqlglot.parse_one(sql)
            if isinstance(parsed, exp.Select):
                # Check if limit exists
                if not parsed.args.get("limit"):
                    parsed = parsed.limit(1000)
                    return parsed.sql()
            return sql
        except Exception:
            return sql

    async def execute_external_query(
        self, conn_model: DbConnection, sql: str, bypass_safety: bool = False
    ) -> Dict[str, Any]:
        """
        Executes a query against the external connection.
        Enforces safety checks unless bypass_safety is True.
        """
        if not bypass_safety:
            if not self.is_safe_query(sql):
                raise ValueError(
                    "Query contains dangerous operations (DELETE, DROP, UPDATE, etc.) and safety bypass is not enabled."
                )

        # Optimize query (add limit)
        final_sql = self.optimize_query(sql)

        # ---------------------------------------------------------
        # Enterprise Edition: Check for cached data (DuckDB)
        # ---------------------------------------------------------
        try:
            if conn_model.sync_config and conn_model.sync_config.last_sync_status == "success":
                # Data is synced! Let's try to run against DuckDB first.
                # We need to rewrite the query to point to the correct schema/dataset.
                # Dataset name is usually `conn_{id}`
                
                dataset_name = connection_schema_name(conn_model.id)
                tables = self._extract_tables(final_sql)
                
                # Check if all tables in the query are in the cache
                cached_tables = conn_model.sync_config.tables_cached or []
                all_cached = all(t.lower() in [ct.lower() for ct in cached_tables] for t in tables)
                
                if all_cached and tables:
                    logger.info(f"Query routing: Hit cache for connection {conn_model.id} (DuckDB)")
                    
                    from app.services.duckdb_manager import duckdb_manager
                    
                    # Rewrite query to namespace table names
                    # e.g. "SELECT * FROM users" -> "SELECT * FROM conn_123.users"
                    # We can use sqlglot for this or just simple search path if safe
                    # Setting search path is safer and easier
                    
                    # Execute in DuckDB with search path
                    # We need to wrap this execution to set search path
                    # But duckdb_manager uses a cursor.
                    
                    # Simple approach: Transpile with sqlglot to add schema
                    rewritten_sql = self._rewrite_query_for_duckdb(final_sql, dataset_name)
                    
                    results = duckdb_manager.execute(rewritten_sql)
                    
                    return {
                        "sql_executed": rewritten_sql,
                        "row_count": len(results),
                        "results": results,
                        "source": "duckdb_cache"
                    }
        except Exception as e:
            logger.warning(f"Failed to query cache, falling back to source: {e}")

        # ---------------------------------------------------------
        # Fallback / Default: Query External Source
        # ---------------------------------------------------------

        try:
            async with self._connection_context(conn_model) as conn:
                try:
                    rows = await asyncio.wait_for(
                        conn.fetch(final_sql),
                        timeout=settings.EXTERNAL_QUERY_TIMEOUT_SECONDS,
                    )
                except asyncio.TimeoutError as exc:
                    raise QueryTimeoutError(
                        f"Query timed out after {settings.EXTERNAL_QUERY_TIMEOUT_SECONDS}s"
                    ) from exc
                results = [dict(row) for row in rows]

                return {
                    "sql_executed": final_sql,
                    "row_count": len(results),
                    "results": results,
                    "source": "database_direct"
                }
        except Exception as e:
            logger.error(f"Error executing query on connection {conn_model.id}: {str(e)}", exc_info=True)
            raise Exception(str(e))

    def _extract_tables(self, sql: str) -> List[str]:
        """Extract table names from SQL."""
        try:
            return [
                t.name 
                for t in sqlglot.parse_one(sql).find_all(exp.Table)
            ]
        except:
            return []

    def _rewrite_query_for_duckdb(self, sql: str, schema: str) -> str:
        """Rewrite query to use specific schema/dataset."""
        try:
            expression = sqlglot.parse_one(sql)
            for table in expression.find_all(exp.Table):
                # Don't qualify if already qualified
                if not table.db:
                    table.set("db", exp.Identifier(this=schema, quoted=False))
            return expression.sql()
        except:
            return sql


connection_service = ConnectionService()
