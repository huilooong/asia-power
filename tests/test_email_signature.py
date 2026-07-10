"""Tests for APSales email signatures."""

import unittest

from sales_core.email_signature import finalize_email_draft, strip_draft_meta


class EmailSignatureTests(unittest.TestCase):
    def test_strip_draft_meta(self) -> None:
        raw = "Hello\n\n(Draft informed by sales intelligence — not sent.)"
        self.assertEqual(strip_draft_meta(raw), "Hello")

    def test_finalize_zh_includes_signature(self) -> None:
        body = "尊敬的客户，您好：\n\n感谢咨询。"
        out = finalize_email_draft(body, "zh")
        self.assertIn("sales@asia-power.com", out)
        self.assertIn("鲁子敬", out)
        self.assertIn("国际销售经理", out)
        self.assertIn("16638801930", out)
        self.assertIn("不接手机来电", out)
        self.assertTrue(out.index("--") > 0)


if __name__ == "__main__":
    unittest.main()
