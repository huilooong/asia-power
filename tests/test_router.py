"""Router keyword tests (no API calls)."""

import unittest

from agents.router import route_message


class RouterTests(unittest.TestCase):
    def test_routes_plan_to_coo(self) -> None:
        msg = "今天我们的计划是部署COO Agent和Sales Agent。"
        self.assertEqual(route_message(msg), "coo")

    def test_routes_sales_inquiry(self) -> None:
        msg = "客户问G4KD发动机多少钱，帮我回复。"
        self.assertEqual(route_message(msg), "sales")

    def test_routes_decision_to_coo(self) -> None:
        msg = "记录一个决定：所有Agent必须通过Tool读写Memory，不能直接写文件。"
        self.assertEqual(route_message(msg), "coo")


if __name__ == "__main__":
    unittest.main()
