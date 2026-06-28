"""Tests for WhatsApp analysis pipeline and report."""

import tempfile
import unittest
from pathlib import Path

from customer_gateway.gateway_readonly import REPORTS_DIR, reconfigure_paths, run_intelligence_analysis
from customer_gateway.whatsapp_importer import import_whatsapp_txt
from customer_gateway.whatsapp_intelligence_report import load_latest_report

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "sample_whatsapp_chat.txt"


class WhatsAppAnalysisTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        reconfigure_paths(Path(self.tmp.name) / "gateway")
        import_whatsapp_txt(FIXTURE)

    def test_analyze_generates_chinese_report(self) -> None:
        report = run_intelligence_analysis()
        self.assertIn("销售智能报告", report)
        self.assertIn("销售漏斗", report)
        self.assertIn("改进建议", report)
        self.assertIn("不盲目模仿", report)

    def test_report_persisted(self) -> None:
        run_intelligence_analysis()
        self.assertTrue((REPORTS_DIR / "latest_report.md").is_file())
        loaded = load_latest_report()
        self.assertIn("WhatsApp 销售智能报告", loaded)

    def test_report_sections(self) -> None:
        report = run_intelligence_analysis()
        for section in ("总体分析", "产品分析", "CEO 销售分析", "跟进分析"):
            self.assertIn(section, report)


if __name__ == "__main__":
    unittest.main()
