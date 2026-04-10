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


def _auto_qualify_all_tables(sql: str) -> str:
    """Attempt to qualify unqualified table names by looking up DuckDB schemas."""
    try:
        table_rows = duckdb_manager.execute(
            "SELECT table_schema, table_name "
            "FROM information_schema.tables "
            "WHERE table_schema NOT IN ('information_schema', 'pg_catalog') "
            "AND table_name NOT LIKE '_dlt_%'"
        )
        table_map: dict = {}
        for row in table_rows:
            table_map.setdefault(row["table_name"], []).append(row["table_schema"])

        expression = sqlglot.parse_one(sql, read="duckdb")
        for table in list(expression.find_all(exp.Table)):
            if table.db or table.catalog:
                continue
            schemas = table_map.get(table.name, [])
            if len(schemas) == 1:
                chosen_schema = schemas[0]
            elif len(schemas) > 1:
                non_staging = [s for s in schemas if not s.endswith("_staging")]
                chosen_schema = non_staging[0] if len(non_staging) == 1 else None
            else:
                chosen_schema = None

            if chosen_schema:
                table.set("db", exp.Identifier(this=chosen_schema, quoted=True))
                table.set("this", exp.Identifier(this=table.name, quoted=True))
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
        msg = str(e)
        # Auto-qualify table names on catalog errors and retry once
        if "Catalog Error" in msg:
            logger.info(f"Catalog error, attempting auto-qualification: {msg}")
            qualified = _auto_qualify_all_tables(working_sql)
            if qualified.strip() != working_sql.strip():
                try:
                    with ThreadPoolExecutor(max_workers=1) as executor:
                        future = executor.submit(duckdb_manager.execute, qualified)
                        try:
                            return future.result(timeout=effective_timeout)
                        except FuturesTimeoutError:
                            return f"Error: QUERY_TIMEOUT after {effective_timeout}s"
                except Exception as retry_e:
                    logger.error(f"Retry after qualification also failed: {retry_e}")
                    return f"Error executing query: {str(retry_e)}"
        logger.error(f"Agent query failed: {e}")
        return f"Error executing query: {msg}"
