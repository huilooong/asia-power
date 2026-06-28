"""Integration tests — agents use LanguageRouter, not hardcoded language rules."""

import tempfile
import unittest
from pathlib import Path
from unittest import mock

from config.prompts import build_apsales_system_prompt
from coo_core.dispatcher import dispatch_message
from core.language_router import init_language_policy, resolve_target_language
from sales_core.apsales_handler import build_apsales_enquiry_prompt, process_apsales_enquiry
from agents.profile_loader import load_profile


class AgentLanguageIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        init_language_policy()
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)

    def test_apsales_prompt_uses_language_router(self) -> None:
        profile = load_profile("apsales")
        with mock.patch(
            "sales_core.apsales_handler.check_inventory_for_enquiry",
            return_value=(False, "no match"),
        ):
            prompt = build_apsales_enquiry_prompt(
                "Bonjour, combien pour moteur G4KD?",
                profile,
            )
        self.assertIn("French", prompt)
        self.assertIn("professional French", prompt)
        self.assertIn("买方需求", prompt)

    def test_apsales_system_prompt_policy_lines(self) -> None:
        prompt = build_apsales_system_prompt(load_profile("apsales"))
        self.assertIn("Language policy:", prompt)
        self.assertIn("mandatory", prompt.lower())

    def test_dispatcher_apsales_french_buyer(self) -> None:
        with mock.patch.dict("os.environ", {}, clear=True):
            out = dispatch_message(
                "/sales customer: Bonjour, prix moteur G4KD?",
                source="cli",
                agent_id="apsales",
            )
        self.assertIn("French", out)

    def test_crm_saves_language_triplet(self) -> None:
        import tools.crm_tool as crm

        crm.CUSTOMERS_DIR = Path(self.tmp.name) / "customers"
        crm.PIPELINE_FILE = Path(self.tmp.name) / "pipeline.md"
        crm.save_customer_record(
            "Ghana Motors",
            detected_language="en",
            communication_language="en",
            preferred_language="en",
            buyer_or_supplier="buyer",
        )
        text = crm.get_customer_summary("Ghana Motors")
        self.assertIn("Detected Language", text)
        self.assertIn("Communication Language", text)
        self.assertIn("Preferred Language", text)

    def test_enquiry_auto_save_language_fields(self) -> None:
        import tools.crm_tool as crm

        crm.CUSTOMERS_DIR = Path(self.tmp.name) / "customers"
        crm.PIPELINE_FILE = Path(self.tmp.name) / "pipeline.md"
        with mock.patch.dict("os.environ", {}, clear=True):
            process_apsales_enquiry("Bonjour, combien pour moteur G4KD?")
        summaries = list(crm.CUSTOMERS_DIR.glob("*.md"))
        self.assertTrue(summaries)
        text = summaries[0].read_text(encoding="utf-8")
        self.assertIn("Detected Language", text)
        self.assertIn("fr", text.lower())

    def test_no_hardcoded_language_in_dispatcher_telegram_path(self) -> None:
        import inspect
        from coo_core import dispatcher

        source = inspect.getsource(dispatcher.dispatch_message)
        self.assertNotIn("与 CEO 通过 Telegram", source)
        self.assertIn("get_router", source)

    def test_resolve_matches_router_for_all_scenarios(self) -> None:
        cases = [
            ("apcoo", "ceo", "hi", "zh"),
            ("apsales", "buyer", "Need engine", "en"),
            ("apsales", "buyer", "Bonjour moteur", "fr"),
            ("apsales", "buyer", "مرحبا", "ar"),
            ("apsupply", "supplier", "价格", "zh"),
            ("apsupply", "supplier", "Please quote engine", "en"),
        ]
        for actor, counterpart, msg, expected in cases:
            with self.subTest(actor=actor, counterpart=counterpart):
                self.assertEqual(resolve_target_language(actor, counterpart, msg), expected)


if __name__ == "__main__":
    unittest.main()
