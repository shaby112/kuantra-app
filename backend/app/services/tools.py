from google.genai import types

# Define the SQL Execution Tool
execute_sql_tool_declaration = types.FunctionDeclaration(
    name="execute_sql_tool",
    description="Executes a SELECT SQL query against the database and returns results as JSON string.",
    parameters={
        "type": "object",
        "properties": {
            "sql_query": {
                "type": "string",
                "description": "The exact SQL query to execute."
            },
            "connection_id": {
                "type": "integer",
                "description": "The ID of the database connection to run the query against."
            }
        },
        "required": ["sql_query", "connection_id"]
    }
)

# Bundle into Tool list
ai_tools = [
    types.Tool(function_declarations=[execute_sql_tool_declaration])
]
