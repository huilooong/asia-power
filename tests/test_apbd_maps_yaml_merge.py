"""Maps / lead_finder YAML merge: load markets + skip deprecated maps batch."""

from __future__ import annotations

import os
import unittest
from unittest import mock

from agents.apbd.lead_finder import (
    _dedupe_queries,
    load_lead_markets_config,
)
from customer_gateway.maps_prospect import (
    maps_prospect_batch_deprecated,
    run_maps_prospect_batch,
)


class LeadMarketsYamlTests(unittest.TestCase):
    def test_load_canonical_yaml(self) -> None:
        cfg = load_lead_markets_config()
        self.assertEqual(cfg["source"], "config/apbd_lead_markets.yaml")
        self.assertGreaterEqual(len(cfg["markets"]), 6)
        self.assertEqual(cfg["search"]["max_queries_per_run"], 20)
        self.assertEqual(cfg["search"]["max_total_leads"], 40)
        countries = {m["country"] for m in cfg["markets"]}
        self.assertIn("Ghana", countries)
        self.assertIn("Saudi Arabia", countries)
        self.assertIn("Malaysia", countries)
        self.assertIn("Indonesia", countries)
        # Accra should include both PHASE1-style and former maps_prospect queries
        accra = next(m for m in cfg["markets"] if m.get("city") == "Accra")
        qset = set(accra["queries"])
        self.assertIn("engine importer Accra Ghana", qset)
        self.assertIn("tokunbo spare parts Accra", qset)

    def test_dedupe_queries_case_insensitive(self) -> None:
        out = _dedupe_queries([
            "Auto Parts Dealer Lagos",
            "auto parts dealer lagos",
            "  auto parts dealer Lagos  ",
            "truck parts dealer Lagos",
        ])
        self.assertEqual(len(out), 2)
        self.assertEqual(out[0], "Auto Parts Dealer Lagos")
        self.assertEqual(out[1], "truck parts dealer Lagos")


class MapsProspectDeprecationTests(unittest.TestCase):
    def test_deprecated_flag_true_by_default(self) -> None:
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("FORCE_LEGACY_MAPS_PROSPECT", None)
            self.assertTrue(maps_prospect_batch_deprecated())

    def test_batch_skips_even_with_force(self) -> None:
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("FORCE_LEGACY_MAPS_PROSPECT", None)
            result = run_maps_prospect_batch(force=True)
        self.assertTrue(result.get("ok"))
        self.assertTrue(result.get("skipped"))
        self.assertEqual(result.get("reason"), "deprecated_merged_into_lead_finder")

    def test_escape_hatch_env(self) -> None:
        with mock.patch.dict(os.environ, {"FORCE_LEGACY_MAPS_PROSPECT": "1"}):
            self.assertFalse(maps_prospect_batch_deprecated())


if __name__ == "__main__":
    unittest.main()
