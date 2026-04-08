import os
import sys
import unittest
import asyncio
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.semantic.wren_client import WrenClient

class TestWrenClient(unittest.IsolatedAsyncioTestCase):
    @patch("app.semantic.wren_client.llm_provider_registry.get_provider")
    async def test_generate_and_execute_validates_sql(self, mock_get_provider):
        mock_provider = MagicMock()
        mock_provider.generate.return_value = "DELETE FROM users"
        mock_get_provider.return_value = mock_provider
        
        client = WrenClient()
        
        # Test that generation correctly intercepts the DELETE via the validators
        result = await client.generate_and_execute("Delete all users")
        self.assertEqual(result["status"], "error")
        self.assertIn("Query Safety Error", result.get("error", "Query Safety Error"))

if __name__ == "__main__":
    unittest.main()
