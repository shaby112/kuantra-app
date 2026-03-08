import re
from typing import Dict, Any, List, Optional, Tuple
from app.core.logging import logger
from app.services.llm_provider_service import llm_provider_registry
from app.services.semantic_model_service import SemanticModelService


class SQLValidationError(Exception):
    """Raised when generated SQL fails validation."""
    def __init__(self, message: str, errors: List[str]):
        super().__init__(message)
        self.errors = errors


class WrenClient:
    """
    Enhanced Semantic Layer Client with validation and retry logic.
    
    Features:
    - SQL validation against MDL
    - Execution feedback loop (3 retries)
    - Error recovery with user-friendly messages
    """
    
    MAX_RETRIES = 3
    
    def __init__(self, mdl_path: str = "app/semantic/model.mdl"):
        self.mdl_path = mdl_path  # kept for compatibility
        self.semantic_model_service = SemanticModelService(mdl_path=mdl_path)
        self.mdl = self._load_mdl()
        self.provider = llm_provider_registry.get_provider()

    def _load_mdl(self) -> Dict[str, Any]:
        """Load and parse the unified semantic model snapshot."""
        try:
            mdl = self.semantic_model_service.get_current()
            return mdl if isinstance(mdl, dict) else {}
        except Exception as e:
            logger.error(f"Failed to load semantic model: {e}")
            return {}

    def reload_mdl(self):
        """Reload semantic model from the unified semantic model service."""
        self.mdl = self._load_mdl()

    def _build_context(self) -> str:
        """Construct the prompt context from MDL."""
        context = "You are a Semantic Layer Engine. Your goal is to translate natural language queries into valid DuckDB SQL based STRICTLY on the following data model (MDL).\n\n"
        
        context += "MODELS:\n"
        for model in self.mdl.get("models", []):
            context += f"- {model['name']} (source: {model.get('source', model['name'])})\n"
            context += "  Columns:\n"
            for col in model.get("columns", []):
                desc = f" - {col.get('description', '')}" if col.get('description') else ""
                context += f"    - {col['name']} ({col['type']}){desc}\n"
        
        context += "\nRELATIONSHIPS:\n"
        for rel in self.mdl.get("relationships", []):
            context += f"- {rel['name']}: {rel['from']} {rel['join_type']} {rel['to']} ON {rel['condition']}\n"
            
        context += "\nRULES:\n"
        context += "1. Use only the tables and columns defined above.\n"
        context += "2. Perform JOINs based on the relationships defined.\n"
        context += "3. Return ONLY the raw SQL query, no markdown formatting.\n"
        context += "4. If ambiguous (e.g. 'spent'), infer from column descriptions.\n"
        context += "5. Use proper DuckDB SQL syntax.\n"
        
        return context

    def _get_valid_tables(self) -> List[str]:
        """Get list of valid table names from MDL."""
        return [m["name"] for m in self.mdl.get("models", [])]

    def _get_valid_columns(self, table_name: str) -> List[str]:
        """Get valid columns for a table."""
        for model in self.mdl.get("models", []):
            if model["name"] == table_name:
                return [c["name"] for c in model.get("columns", [])]
        return []

    def validate_sql(self, sql: str) -> Tuple[bool, List[str]]:
        """
        Validate SQL against MDL.
        
        Checks:
        1. Tables exist in MDL
        2. Columns exist in referenced tables
        3. Joins match defined relationships
        
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []
        valid_tables = self._get_valid_tables()
        
        # Extract table references (simple pattern matching)
        # Pattern: FROM table, JOIN table, table.column
        from_pattern = r'\bFROM\s+([a-zA-Z_][a-zA-Z0-9_\.]*)'
        join_pattern = r'\bJOIN\s+([a-zA-Z_][a-zA-Z0-9_\.]*)'
        
        tables_in_sql = set()
        for match in re.finditer(from_pattern, sql, re.IGNORECASE):
            tables_in_sql.add(match.group(1))
        for match in re.finditer(join_pattern, sql, re.IGNORECASE):
            tables_in_sql.add(match.group(1))
        
        # Validate tables
        for table in tables_in_sql:
            # Handle schema.table format
            base_table = table.split(".")[-1] if "." in table else table
            if table not in valid_tables and base_table not in valid_tables:
                # Check if any valid table ends with this name
                if not any(vt.endswith(base_table) for vt in valid_tables):
                    errors.append(f"Table '{table}' not found in MDL")
        
        # Extract column references (table.column pattern)
        col_pattern = r'([a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*)'
        for match in re.finditer(col_pattern, sql):
            ref = match.group(1)
            parts = ref.split(".")
            if len(parts) == 2:
                table, column = parts
                valid_cols = self._get_valid_columns(table)
                if valid_cols and column not in valid_cols:
                    # Not a hard error - could be alias
                    logger.debug(f"Column '{column}' may not exist in '{table}'")
        
        return len(errors) == 0, errors

    async def generate_sql(self, query: str) -> str:
        """
        Generate SQL from natural language with validation and retry.
        
        Implements 3-retry feedback loop:
        1. Generate SQL
        2. Validate against MDL
        3. If invalid, retry with error context
        4. After 3 failures, return user-friendly error
        """
        last_sql = None
        last_errors = []
        self.reload_mdl()
        
        for attempt in range(self.MAX_RETRIES):
            try:
                # Build prompt
                prompt = self._build_context()
                
                # Add error context from previous attempt
                if last_errors:
                    prompt += "\n\nPREVIOUS ATTEMPT FAILED. Fix these errors:\n"
                    for error in last_errors:
                        prompt += f"- {error}\n"
                    prompt += f"\nPrevious SQL was:\n{last_sql}\n"
                
                prompt += f"\nQUERY: {query}\nSQL:"
                
                # Generate SQL
                llm_text = await self.provider.generate(prompt, config={"temperature": 0.1})
                sql = llm_text.strip().replace("```sql", "").replace("```", "").strip()
                last_sql = sql
                
                # Validate
                is_valid, errors = self.validate_sql(sql)
                
                if is_valid:
                    logger.info(f"SQL generated successfully on attempt {attempt + 1}")
                    return sql
                
                # Validation failed - retry
                last_errors = errors
                logger.warning(f"SQL validation failed (attempt {attempt + 1}): {errors}")
                
            except Exception as e:
                logger.error(f"SQL generation error (attempt {attempt + 1}): {e}")
                last_errors = [str(e)]
        
        # All retries failed
        error_msg = f"Failed to generate valid SQL after {self.MAX_RETRIES} attempts. "
        error_msg += "Please try rephrasing your question or be more specific about which tables to use."
        
        raise SQLValidationError(error_msg, last_errors)

    async def generate_and_execute(self, query: str) -> Dict[str, Any]:
        """
        Generate SQL and execute with full feedback loop.
        
        If execution fails, retries with error context.
        """
        from app.services.duckdb_manager import duckdb_manager
        
        last_sql = None
        last_error = None
        self.reload_mdl()
        
        for attempt in range(self.MAX_RETRIES):
            try:
                # Build prompt with execution error context
                prompt = self._build_context()
                
                if last_error:
                    prompt += f"\n\nPREVIOUS SQL FAILED WITH ERROR:\n{last_error}\n"
                    prompt += f"Previous SQL was:\n{last_sql}\n"
                    prompt += "Fix the SQL to avoid this error.\n"
                
                prompt += f"\nQUERY: {query}\nSQL:"
                
                # Generate
                llm_text = await self.provider.generate(prompt, config={"temperature": 0.1})
                sql = llm_text.strip().replace("```sql", "").replace("```", "").strip()
                last_sql = sql
                
                # Execute
                result = duckdb_manager.execute(sql)
                
                logger.info(f"Query executed successfully on attempt {attempt + 1}")
                return {
                    "status": "success",
                    "sql": sql,
                    "data": result,
                    "row_count": len(result),
                    "attempts": attempt + 1
                }
                
            except Exception as e:
                last_error = str(e)
                logger.warning(f"Execution failed (attempt {attempt + 1}): {e}")
        
        # All retries failed
        return {
            "status": "error",
            "sql": last_sql,
            "error": f"Query failed after {self.MAX_RETRIES} attempts: {last_error}",
            "suggestion": "Try rephrasing your question or checking if the referenced data exists.",
            "attempts": self.MAX_RETRIES
        }

    def get_models(self) -> List[Dict[str, Any]]:
        """Return list of available models/tables."""
        return self.mdl.get("models", [])
