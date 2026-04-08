import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.connection_service import ConnectionService, QuerySafetyError


class TestSQLGuardrails(unittest.TestCase):
    def setUp(self):
        self.service = ConnectionService()

    def test_read_only_enforcement_blocks_write(self):
        with self.assertRaises(QuerySafetyError):
            self.service.enforce_read_only("DELETE FROM users")

    def test_read_only_enforcement_blocks_multi_statement(self):
        with self.assertRaises(QuerySafetyError):
            self.service.enforce_read_only("SELECT 1; SELECT 2")

    def test_sandbox_adds_default_limit(self):
        sql = self.service.apply_query_sandbox("SELECT id FROM users")
        self.assertIn("LIMIT 1000", sql.upper())

    def test_sandbox_caps_high_limit(self):
        sql = self.service.apply_query_sandbox("SELECT id FROM users LIMIT 200000")
        self.assertIn("LIMIT 5000", sql.upper())

    def test_cost_estimation_blocks_high_risk_query(self):
        cost = self.service.estimate_query_cost("SELECT * FROM users")
        self.assertEqual(cost["action"], "block")


if __name__ == "__main__":
    unittest.main()
