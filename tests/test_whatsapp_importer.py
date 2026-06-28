"""Tests for WhatsApp txt import."""

import tempfile
import unittest
from pathlib import Path

from customer_gateway.gateway_readonly import reconfigure_paths
from customer_gateway.whatsapp_importer import import_whatsapp_txt

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "sample_whatsapp_chat.txt"


class WhatsAppImporterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        reconfigure_paths(Path(self.tmp.name) / "gateway")

    def test_import_sample_chat(self) -> None:
        result = import_whatsapp_txt(FIXTURE)
        self.assertIn("import OK", result)
        self.assertIn("Ghana Motors", result)
        self.assertIn("Messages:", result)

    def test_import_missing_file(self) -> None:
        result = import_whatsapp_txt("/no/such/chat.txt")
        self.assertIn("not found", result)


if __name__ == "__main__":
    unittest.main()
