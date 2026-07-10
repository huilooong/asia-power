"""Tests for unified language policy configuration and routing."""

import tempfile
import unittest
from pathlib import Path

from core.language_router import (
    LanguageRouter,
    detect_language,
    init_language_policy,
    resolve_target_language,
)


class LanguagePolicyTests(unittest.TestCase):
    def setUp(self) -> None:
        init_language_policy()

    def test_internal_apcoo_to_ceo_chinese(self) -> None:
        self.assertEqual(resolve_target_language("apcoo", "ceo", "Hello CEO"), "zh")

    def test_internal_ceo_to_apcoo_chinese(self) -> None:
        self.assertEqual(resolve_target_language("ceo", "apcoo", "Need a plan"), "zh")

    def test_buyer_english_default(self) -> None:
        self.assertEqual(
            resolve_target_language("apsales", "buyer", "Need G4KD engine price FOB"),
            "en",
        )

    def test_buyer_french_detected(self) -> None:
        self.assertEqual(
            resolve_target_language(
                "apsales",
                "buyer",
                "Bonjour, combien pour moteur G4KD livraison?",
            ),
            "fr",
        )

    def test_buyer_arabic_detected(self) -> None:
        self.assertEqual(
            resolve_target_language("apsales", "buyer", "مرحبا أريد سعر محرك هيونداي"),
            "ar",
        )

    def test_supplier_chinese_default(self) -> None:
        self.assertEqual(
            resolve_target_language("apsupply", "supplier", "这个发动机有现货吗？"),
            "zh",
        )

    def test_supplier_english_detected(self) -> None:
        self.assertEqual(
            resolve_target_language(
                "apsupply",
                "supplier",
                "Hello, please quote G4KD engine price and delivery time.",
            ),
            "en",
        )

    def test_buyer_chinese_detected(self) -> None:
        self.assertEqual(
            resolve_target_language("apsales", "buyer", "你好，我需要3台丰田2az发动机"),
            "zh",
        )

    def test_detect_language_buyer_scenario(self) -> None:
        self.assertEqual(detect_language("Bonjour moteur", scenario="buyer"), "fr")
        self.assertEqual(detect_language("你好", scenario="buyer"), "zh")

    def test_detect_language_supplier_scenario(self) -> None:
        self.assertEqual(detect_language("现货价格多少", scenario="supplier"), "zh")
        self.assertEqual(
            detect_language("Please send quote for G4KD", scenario="supplier"),
            "en",
        )

    def test_custom_policy_yaml(self) -> None:
        with tempfile.NamedTemporaryFile("w", suffix=".yaml", delete=False) as f:
            f.write(
                "internal:\n  default: zh\n  participants: [ceo, apcoo]\n"
                "buyer:\n  default: en\n  auto_detect: true\n  supported: [en, fr]\n"
                "supplier:\n  default: zh\n  auto_detect: true\n  supported: [zh, en]\n"
            )
            path = Path(f.name)
        try:
            router = LanguageRouter.from_yaml(path)
            self.assertEqual(router.default_for("buyer"), "en")
            self.assertEqual(router.supported_for("buyer"), frozenset({"en", "fr"}))
        finally:
            path.unlink(missing_ok=True)

    def test_classify_scenario(self) -> None:
        router = LanguageRouter()
        self.assertEqual(router.classify_scenario("apcoo", "ceo"), "internal")
        self.assertEqual(router.classify_scenario("apsales", "buyer"), "buyer")
        self.assertEqual(router.classify_scenario("apsupply", "supplier"), "supplier")


if __name__ == "__main__":
    unittest.main()
