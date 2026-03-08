from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from typing import List, Dict, Any, Optional, Union
import sqlglot
from sqlglot import exp
from app.services.duckdb_manager import duckdb_manager
from app.core.config import settings
from app.core.logging import logger
from app.utils.identifiers import connection_schema_name

def _is_read_only_sql(sql: str) -> bool:
    try:
        parsed_list = sqlglot.parse(sql, read="duckdb")
        if not parsed_list:
            return False
        dangerous = (
            exp.Delete,
            exp.Update,
            exp.Drop,
            exp.TruncateTable,
            exp.Insert,
            exp.Alter,
            exp.Create,
        )
        for parsed in parsed_list:
            if isinstance(parsed, dangerous):
                return False
            for node in parsed.walk():
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


def _qualify_tables(sql: str, schema_name: str) -> str:
    """Qualify unqualified table references with a connection schema."""
    try:
        expression = sqlglot.parse_one(sql, read="duckdb")
        for table in expression.find_all(exp.Table):
            if not table.db:
                table.set("db", exp.Identifier(this=schema_name, quoted=False))
        return expression.sql(dialect="duckdb")
    except Exception:
        return sql


def execute_analytical_query(
    sql: str,
    connection_ids: Optional[List[str]] = None,
    timeout_s: Optional[int] = None,
) -> Union[List[Dict[str, Any]], str]:
    """
    Executes a read-only analytical SQL query against the data warehouse.
    
    Args:
        sql: The SQL query to execute. MUST be a SELECT statement.
        connection_ids: Optional list of synced connection IDs. If one ID is provided,
            unqualified table names are scoped to that `conn_<id>` schema.
        timeout_s: Query timeout in seconds.
        
    Returns:
        A list of dictionaries representing the rows, or an error message string.
    """
    if not _is_read_only_sql(sql):
        return "Error: Only SELECT queries are allowed for analysis."

    working_sql = sql
    if connection_ids and len(connection_ids) == 1:
        working_sql = _qualify_tables(working_sql, connection_schema_name(connection_ids[0]))

    effective_timeout = timeout_s or settings.ANALYTICAL_QUERY_TIMEOUT_SECONDS

    try:
        logger.info(f"Agent executing query: {working_sql}")
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(duckdb_manager.execute, working_sql)
            try:
                results = future.result(timeout=effective_timeout)
            except FuturesTimeoutError:
                return f"Error: QUERY_TIMEOUT after {effective_timeout}s"
        return results
    except Exception as e:
        logger.error(f"Agent query failed: {e}")
        return f"Error executing query: {str(e)}"
