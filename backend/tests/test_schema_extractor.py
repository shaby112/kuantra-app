import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.schema_extractor import extract_schema_ddl

class TestSchemaExtractor(unittest.TestCase):
    @patch("app.services.schema_extractor.duckdb_manager.get_tables")
    @patch("app.services.schema_extractor.duckdb_manager.get_table_schema")
    def test_extract_schema_ddl_privacy(self, mock_schema, mock_tables):
        """
        Verify that schema extraction ONLY outputs DDL metadata and does not fetch or expose rows.
        """
        mock_tables.return_value = ["customers", "orders"]
        
        def fake_schema(table_name):
            if table_name == "customers":
                return [
                    {"column_name": "id", "data_type": "INTEGER"},
                    {"column_name": "email", "data_type": "VARCHAR"},
                ]
            return [{"column_name": "id", "data_type": "INTEGER"}]
            
        mock_schema.side_effect = fake_schema
        
        ddl = extract_schema_ddl()
        
        # Test structural integrity
        self.assertIn("CREATE TABLE customers", ddl)
        self.assertIn("email VARCHAR", ddl)
        
        # Test privacy guards (no data queries)
        # Because we only called get_tables and get_table_schema, we didn't query data
        self.assertNotIn("INSERT", ddl)
        self.assertNotIn("VALUES", ddl)
        self.assertIn("-- DO NOT USE ROW DATA", ddl)

if __name__ == "__main__":
    unittest.main()
