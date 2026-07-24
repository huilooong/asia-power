"""APBD Canada leads module — fixtures, scoring, Chinese evidence rules, missing key."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "tests" / "fixtures" / "apbd_leads" / "canada_sample.json"


class ApbdLeadsFixtureTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name)
        self.patches = [
            mock.patch("agents.apbd.leads.repository.DB_DIR", self.db),
            mock.patch("agents.apbd.leads.repository.COMPANIES_FILE", self.db / "companies.json"),
            mock.patch("agents.apbd.leads.repository.TASKS_FILE", self.db / "search_tasks.json"),
            mock.patch("agents.apbd.leads.repository.CHANGES_FILE", self.db / "change_history.jsonl"),
            mock.patch("agents.apbd.leads.repository.RAW_DIR", self.db / "raw_places"),
            mock.patch("agents.apbd.leads.review_queue.QUEUE_FILE", self.db / "review_queue.json"),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self) -> None:
        for p in self.patches:
            p.stop()
        self.tmp.cleanup()

    def test_configs_load(self) -> None:
        from agents.apbd.leads.market_config import get_country, keyword_lists, load_markets, load_scoring

        markets = load_markets()
        ca = get_country(markets, "CA")
        self.assertEqual(ca["target_total"], 500)
        self.assertIn("Richmond", ca["regions"][1]["cities"])
        kw = keyword_lists()
        self.assertIn("engine replacement", kw["powertrain"])
        scoring = load_scoring()
        self.assertEqual(scoring["version"], "ca-auto-repair-v1")

    def test_chinese_evidence_vs_name_only(self) -> None:
        from agents.apbd.leads.pipeline import ingest_fixture_companies
        from agents.apbd.leads.repository import load_companies

        data = json.loads(FIXTURE.read_text(encoding="utf-8"))
        ingest_fixture_companies(data["companies"])
        by_id = {c["id"]: c for c in load_companies()}

        cn = by_id["lead-fixture-cn001"]
        self.assertIn(
            cn["chinese_relevance"]["status"],
            ("confirmed_chinese_service", "confirmed_chinese_business"),
        )
        self.assertTrue(cn["chinese_relevance"]["evidence_text"])

        name_only = by_id["lead-fixture-nameonly"]
        self.assertEqual(name_only["chinese_relevance"]["status"], "unknown")

        oil = by_id["lead-fixture-oilonly"]
        self.assertLess(float(oil["score"] or 0), float(cn["score"] or 0))
        pen_codes = {p.get("code") for p in (oil.get("score_breakdown") or {}).get("penalties") or []}
        self.assertTrue(pen_codes & {"oil_change_only", "detailing_only", "national_chain"})

    def test_place_id_dedupe(self) -> None:
        from agents.apbd.leads.adapters.places import ingest_place_rows
        from agents.apbd.leads.repository import load_companies

        row = {
            "name": "Test Garage",
            "address": "1 Main St, Richmond, BC",
            "phone": "6045550001",
            "website": "https://example.test",
            "place_id": "pid-dedupe-1",
            "city": "Richmond",
            "maps_url": "https://maps.google.com/?q=pid-dedupe-1",
            "rating": 4.0,
            "types": ["car_repair"],
        }
        t1 = ingest_place_rows([row], country_code="CA")
        t2 = ingest_place_rows([row], country_code="CA")
        self.assertEqual(t1["added"], 1)
        self.assertEqual(t2["duplicates"], 1)
        self.assertEqual(len(load_companies()), 1)

    def test_missing_places_key_hard_fail(self) -> None:
        from agents.apbd.leads.pipeline import run_discover

        with mock.patch("agents.apbd.leads.adapters.places.require_places_key") as req:
            from agents.apbd.leads.adapters.places import PlacesConfigError

            req.side_effect = PlacesConfigError("missing_places_api_key: set GOOGLE_PLACES_API_KEY")
            result = run_discover(country="CA", city="Richmond", limit=5)
        self.assertFalse(result["ok"])
        self.assertEqual(result["error_code"], "missing_places_api_key")

    def test_dry_run_does_not_require_places_key(self) -> None:
        from agents.apbd.leads.pipeline import run_discover

        with mock.patch("agents.apbd.leads.adapters.places.require_places_key") as req:
            result = run_discover(country="CA", city="Richmond", limit=5, dry_run=True)
        req.assert_not_called()
        self.assertTrue(result["ok"])
        self.assertTrue(result["dry_run"])
        self.assertGreater(result["planned_queries"], 0)

    def test_quota_error_stops_run_and_reports_failure(self) -> None:
        from agents.apbd.leads.adapters.places import PlacesQuotaError
        from agents.apbd.leads.pipeline import run_discover

        with (
            mock.patch("agents.apbd.leads.pipeline.require_places_key", return_value="test-key"),
            mock.patch(
                "agents.apbd.leads.pipeline.discover_query",
                side_effect=PlacesQuotaError("429 quota exhausted"),
            ),
        ):
            result = run_discover(country="CA", city="Richmond", limit=5)
        self.assertFalse(result["ok"])
        self.assertTrue(result["quota_exhausted"])
        self.assertEqual(result["added"], 0)

    def test_approve_query_for_sales(self) -> None:
        from agents.apbd.leads.pipeline import ingest_fixture_companies
        from agents.apbd.leads.query import approved_for_outreach, to_outreach_candidate
        from agents.apbd.leads.review_queue import approve_for_outreach

        data = json.loads(FIXTURE.read_text(encoding="utf-8"))
        ingest_fixture_companies(data["companies"])
        approve_for_outreach("lead-fixture-cn001", reviewer="test")
        rows = approved_for_outreach(country="CA", limit=10)
        self.assertEqual(len(rows), 1)
        cand = to_outreach_candidate(rows[0])
        self.assertEqual(cand["source"], "apbd_leads")
        self.assertIn("Richmond", cand["reason"])

    def test_export_csv(self) -> None:
        from agents.apbd.leads.export import export_leads
        from agents.apbd.leads.pipeline import ingest_fixture_companies

        data = json.loads(FIXTURE.read_text(encoding="utf-8"))
        ingest_fixture_companies(data["companies"])
        with mock.patch("agents.apbd.leads.export.EXPORT_DIR", self.db / "exports"):
            result = export_leads(country="CA", fmt="csv")
        self.assertTrue(result["ok"])
        self.assertGreaterEqual(result["count"], 3)
        self.assertTrue(Path(result["paths"]["csv"]).is_file())


if __name__ == "__main__":
    unittest.main()
