"""Tests for core language router API."""

import unittest

from core.language_router import (
    customer_draft_instruction,
    detect_customer_language,
    detect_language,
    language_label,
    resolve_target_language,
)


class LanguageRouterTests(unittest.TestCase):
    def test_english_default(self) -> None:
        self.assertEqual(detect_customer_language("Need G4KD engine price FOB"), "en")
        self.assertEqual(detect_language("Need G4KD engine price FOB", scenario="buyer"), "en")

    def test_french_detection(self) -> None:
        self.assertEqual(
            detect_customer_language("Bonjour, combien pour moteur G4KD livraison?"),
            "fr",
        )

    def test_arabic_detection(self) -> None:
        self.assertEqual(
            detect_customer_language("مرحبا أريد سعر محرك هيونداي"),
            "ar",
        )

    def test_draft_instruction_english(self) -> None:
        instr = customer_draft_instruction("en")
        self.assertIn("English", instr)
        self.assertIn("Never use Chinese", instr)

    def test_draft_instruction_french(self) -> None:
        instr = customer_draft_instruction("fr")
        self.assertIn("French", instr)

    def test_draft_instruction_arabic(self) -> None:
        instr = customer_draft_instruction("ar")
        self.assertIn("Arabic", instr)

    def test_language_labels(self) -> None:
        self.assertEqual(language_label("fr"), "French")

    def test_resolve_internal(self) -> None:
        self.assertEqual(resolve_target_language("apsales", "apcoo", "hello"), "zh")


if __name__ == "__main__":
    unittest.main()
