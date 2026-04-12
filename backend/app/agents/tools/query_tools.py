import datetime as _dt
import re
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from decimal import Decimal
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


def _strip_short_table_aliases(sql: str) -> str:
    """Replace short table aliases (T1, T2, t1, a, b) with actual table names.

    LLMs often generate ``FROM table_name T1`` and then reference ``T1.col``.
    DuckDB can misinterpret these as VALUES-list references, especially after
    schema-qualification rewrites.  Expanding them to the real table name
    avoids the ``Values list "T1" does not have a column`` class of errors.
    """
    try:
        expression = sqlglot.parse_one(sql, read="duckdb")

        # Collect alias -> real table name mapping (only for short aliases)
        alias_map: dict[str, str] = {}
        for table in expression.find_all(exp.Table):
            alias = table.alias
            if alias and re.fullmatch(r"[A-Za-z]\d{0,2}", alias):
                alias_map[alias] = table.name

        if not alias_map:
            return sql

        # Remove the alias from the FROM clause and rewrite column references
        for table in expression.find_all(exp.Table):
            alias = table.alias
            if alias in alias_map:
                table.set("alias", None)

        for col in expression.find_all(exp.Column):
            tbl_ref = col.table
            if tbl_ref in alias_map:
                col.set("table", exp.Identifier(this=alias_map[tbl_ref], quoted=False))

        return expression.sql(dialect="duckdb")
    except Exception:
        return sql


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
    """Qualify unqualified table names by looking up DuckDB schemas.

    Also fixes common LLM errors:
    - Fuzzy-matches table names that are close but not exact (e.g. missing underscores)
    - Quotes unquoted multi-word column aliases
    """
    try:
        table_rows = duckdb_manager.execute(
            "SELECT table_schema, table_name "
            "FROM information_schema.tables "
            "WHERE table_schema NOT IN ('information_schema', 'pg_catalog') "
            "AND table_name NOT LIKE '_dlt_%'"
        )
        table_map: dict = {}
        all_names: list = []
        for row in table_rows:
            table_map.setdefault(row["table_name"], []).append(row["table_schema"])
            all_names.append(row["table_name"])

        expression = sqlglot.parse_one(sql, read="duckdb")

        # Track renames so we can propagate to column references
        rename_map: dict[str, str] = {}  # old_name -> new_name

        for table in list(expression.find_all(exp.Table)):
            if table.db or table.catalog:
                continue

            original_name = table.name
            name = original_name
            schemas = table_map.get(name, [])

            # Fuzzy match: if exact lookup fails, try normalized match
            if not schemas:
                normalized = name.replace("-", "_").lower()
                for real_name in all_names:
                    if real_name.replace("-", "_").lower() == normalized:
                        name = real_name
                        schemas = table_map.get(name, [])
                        break
                # Also try stripping/adding underscores for LLM typos
                if not schemas:
                    for real_name in all_names:
                        if real_name.replace("_", "") == name.replace("_", ""):
                            name = real_name
                            schemas = table_map.get(name, [])
                            break

            if len(schemas) == 1:
                chosen_schema = schemas[0]
            elif len(schemas) > 1:
                non_staging = [s for s in schemas if not s.endswith("_staging")]
                chosen_schema = non_staging[0] if len(non_staging) == 1 else None
            else:
                chosen_schema = None

            if chosen_schema:
                table.set("db", exp.Identifier(this=chosen_schema, quoted=True))
                table.set("this", exp.Identifier(this=name, quoted=True))
                if name != original_name:
                    rename_map[original_name] = name

        # Propagate table renames to column references (SELECT, WHERE, GROUP BY, etc.)
        if rename_map:
            for col in expression.find_all(exp.Column):
                if col.table and col.table in rename_map:
                    col.set("table", exp.Identifier(this=rename_map[col.table], quoted=True))

        result = expression.sql(dialect="duckdb")

        # Fix unquoted multi-word aliases: AS Foo Bar -> AS "Foo Bar"
        _SQL_KEYWORDS = {
            "FROM", "WHERE", "GROUP", "ORDER", "HAVING", "LIMIT", "JOIN",
            "LEFT", "RIGHT", "INNER", "OUTER", "CROSS", "ON", "AND", "OR",
            "AS", "SELECT", "INTO", "UNION", "EXCEPT", "INTERSECT", "WITH",
        }

        def _fix_alias(m: re.Match) -> str:
            words = m.group(1).split()
            alias_words = []
            for w in words:
                if w.upper() in _SQL_KEYWORDS:
                    break
                alias_words.append(w)
            if len(alias_words) < 2:
                # Not a multi-word alias — put everything back unchanged
                return m.group(0)
            quoted = " ".join(alias_words)
            rest = " ".join(words[len(alias_words):])
            return f'AS "{quoted}" {rest}' if rest else f'AS "{quoted}"'

        result = re.sub(
            r'\bAS\s+([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)+)',
            _fix_alias,
            result,
        )

        return result
    except Exception:
        return sql


def _fix_group_by(sql: str) -> str:
    """Add missing non-aggregated SELECT columns to GROUP BY.

    DuckDB (like standard SQL) requires every non-aggregated column in
    SELECT to appear in GROUP BY.  Small LLMs frequently omit them.
    """
    try:
        expression = sqlglot.parse_one(sql, read="duckdb")

        # Only fix top-level SELECTs that already have a GROUP BY
        group = expression.find(exp.Group)
        if not group:
            return sql

        # Existing GROUP BY column names (lowercased, unqualified)
        existing_group_cols: set[str] = set()
        for gexpr in group.expressions:
            if isinstance(gexpr, exp.Column):
                existing_group_cols.add(gexpr.name.lower())

        # Identify non-aggregated columns in SELECT
        agg_types = (exp.Sum, exp.Avg, exp.Count, exp.Min, exp.Max, exp.AnyValue)
        missing = []
        for sel in expression.find(exp.Select).expressions:
            # Unwrap alias
            inner = sel.this if isinstance(sel, exp.Alias) else sel
            if isinstance(inner, exp.Column):
                # Check if this column is inside an aggregate
                is_agg = any(isinstance(p, agg_types) for p in inner.walk(bfs=False))
                if not is_agg and inner.name.lower() not in existing_group_cols:
                    missing.append(inner.copy())

        if missing:
            for col_expr in missing:
                group.append("expressions", col_expr)
            return expression.sql(dialect="duckdb")

        return sql
    except Exception:
        return sql


def _fix_wrong_table_columns(sql: str) -> str:
    """Fix columns that reference the wrong table.

    Small LLMs often SELECT a column from a table that doesn't have it
    (e.g. ``SELECT col_x FROM table_a`` when ``col_x`` actually lives on
    ``table_b``).  We look up the real owner in DuckDB metadata and:
      - If ALL columns belong to a single different table, swap FROM.
      - Otherwise repoint column refs to correct tables already in FROM.
    """
    try:
        expression = sqlglot.parse_one(sql, read="duckdb")

        # Build column ownership index from DuckDB
        col_rows = duckdb_manager.execute(
            "SELECT table_schema, table_name, column_name "
            "FROM information_schema.columns "
            "WHERE table_schema NOT IN ('information_schema', 'pg_catalog') "
            "AND table_name NOT LIKE '_dlt_%' "
            "AND column_name NOT LIKE '_dlt_%'"
        )
        col_to_tables: Dict[str, List[tuple]] = {}
        table_cols: Dict[str, set] = {}
        for row in col_rows:
            cname = row["column_name"].lower()
            schema = row["table_schema"]
            tname = row["table_name"]
            col_to_tables.setdefault(cname, []).append((schema, tname))
            table_cols.setdefault(tname.lower(), set()).add(cname)

        # Collect FROM tables
        from_table_nodes = list(expression.find_all(exp.Table))
        from_tables: Dict[str, str] = {}
        for table in from_table_nodes:
            from_tables[table.name.lower()] = table.db if table.db else ""

        if not from_tables:
            return sql

        # Gather all referenced column names (unqualified)
        ref_cols: list[str] = []
        for col in expression.find_all(exp.Column):
            ref_cols.append(col.name.lower())

        if not ref_cols:
            return sql

        # Single-table query: check if ALL columns belong to a different table
        if len(from_tables) == 1:
            from_tbl = list(from_tables.keys())[0]
            from_cols = table_cols.get(from_tbl, set())
            wrong = [c for c in ref_cols if c not in from_cols and c in col_to_tables]

            if wrong and len(wrong) == len([c for c in ref_cols if c not in from_cols]):
                # Find a single table that owns ALL the wrong columns
                candidates: Dict[str, int] = {}
                for c in wrong:
                    for _schema, tname in col_to_tables[c]:
                        candidates[tname] = candidates.get(tname, 0) + 1
                best = max(candidates, key=candidates.get) if candidates else None
                # Only swap if the target table owns ALL referenced columns
                # (wrong ones plus the ones already correct on the original).
                all_ref_unique = set(ref_cols)
                if best and all_ref_unique.issubset(table_cols.get(best.lower(), set())):
                    for table_node in from_table_nodes:
                        if table_node.name.lower() == from_tbl:
                            table_node.set("this", exp.Identifier(this=best, quoted=False))
                            table_node.set("db", None)  # let auto-qualify fix schema
                    return expression.sql(dialect="duckdb")

        # Multi-table or partial mismatch: repoint individual column refs
        needs_rewrite = False
        for col in expression.find_all(exp.Column):
            cname = col.name.lower()
            tbl_ref = col.table.lower() if col.table else ""

            if tbl_ref and tbl_ref in table_cols:
                if cname not in table_cols[tbl_ref]:
                    owners = col_to_tables.get(cname, [])
                    for _schema, real_table in owners:
                        if real_table.lower() in from_tables:
                            col.set("table", exp.Identifier(this=real_table, quoted=False))
                            needs_rewrite = True
                            break
            elif not tbl_ref and len(from_tables) > 1:
                # Ambiguous column in multi-table query — qualify it
                owners = col_to_tables.get(cname, [])
                for _schema, real_table in owners:
                    if real_table.lower() in from_tables:
                        col.set("table", exp.Identifier(this=real_table, quoted=False))
                        needs_rewrite = True
                        break

        if needs_rewrite:
            return expression.sql(dialect="duckdb")
        return sql
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

    # Fix LLM quirks before schema qualification
    working_sql = _strip_short_table_aliases(working_sql)
    working_sql = _fix_group_by(working_sql)

    if connection_ids and len(connection_ids) == 1:
        working_sql = _qualify_tables(working_sql, connection_schema_name(connection_ids[0]))

    # Always auto-qualify unqualified table names upfront
    working_sql = _auto_qualify_all_tables(working_sql)

    # Fix columns referencing the wrong table (LLM confusion)
    working_sql = _fix_wrong_table_columns(working_sql)

    effective_timeout = timeout_s or settings.ANALYTICAL_QUERY_TIMEOUT_SECONDS

    try:
        logger.info(f"Agent executing query: {working_sql}")
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(duckdb_manager.execute, working_sql)
            try:
                results = future.result(timeout=effective_timeout)
            except FuturesTimeoutError:
                return f"Error: QUERY_TIMEOUT after {effective_timeout}s"
        return _serialize_rows(results) if isinstance(results, list) else results
    except Exception as e:
        msg = str(e)
        logger.error(f"Agent query failed: {e}")
        return f"Error executing query: {msg}"


def _serialize_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Ensure all values are JSON-serializable (Decimal, datetime, etc.)."""
    serialized = []
    for row in rows:
        clean: Dict[str, Any] = {}
        for k, v in row.items():
            if isinstance(v, Decimal):
                clean[k] = float(v)
            elif isinstance(v, (_dt.datetime, _dt.date)):
                clean[k] = v.isoformat()
            else:
                clean[k] = v
        serialized.append(clean)
    return serialized
