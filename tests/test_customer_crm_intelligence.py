"""Phase 3 — vehicle entity extractor + CRM intelligence."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from customer_gateway import sales_intelligence_paths as sip
from customer_gateway.vehicle_entity_extractor import (
    extract_from_message,
    extract_from_messages,
    is_broadcast_catalog_message,
    persist_vehicle_inquiries_for_contact,
)
from truth.customer_crm_intelligence import load_customer_crm_data


class VehicleEntityExtractorTests(unittest.TestCase):
    def test_extract_brand_engine_year(self) -> None:
        rows = extract_from_message(
            "Matiz 2 automatic engine? Need Hyundai G4KD 2012",
            mentioned_at="2026-07-01T10:00:00Z",
            source_conversation_id="bbba4fd806e492b1",
        )
        self.assertTrue(rows)
        brands = {r["brand"] for r in rows if r.get("brand")}
        engines = {r["engine_code"] for r in rows if r.get("engine_code")}
        years = {r["year"] for r in rows if r.get("year")}
        self.assertIn("Hyundai", brands)
        self.assertIn("G4KD", engines)
        self.assertIn(2012, years)
        self.assertTrue(all(r.get("model") is None for r in rows))
        self.assertTrue(all(r.get("part") is None for r in rows))

    def test_broadcast_catalog_excluded(self) -> None:
        blast = "到货清单 G4KD G4KA G4KE G4KJ index.html GHS 19090"
        self.assertTrue(is_broadcast_catalog_message(blast))
        self.assertEqual(extract_from_message(blast), [])

    def test_customer_only_skips_ceo(self) -> None:
        msgs = [
            {"text": "Need Toyota 1NZ 2010", "is_ceo": False, "timestamp": "t1"},
            {"text": "We have G4KD G4KA G4KE in stock", "is_ceo": True, "timestamp": "t2"},
        ]
        rows = extract_from_messages(msgs, source_conversation_id="c1", customer_only=True)
        engines = {r["engine_code"] for r in rows if r.get("engine_code")}
        self.assertIn("1NZ", engines)
        self.assertNotIn("G4KD", engines)


class CustomerCrmIntelligenceTests(unittest.TestCase):
    def test_single_and_aggregate(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            sip.reconfigure_paths(Path(tmp))
            tiers = {
                "by_contact": {"233555000111": "潜在客户", "杨浩安信": "B级客户"},
                "customer_tiers": {"潜在客户": 1, "B级客户": 1},
                "other_roles": {},
                "effective_customers": 2,
            }
            sip.CUSTOMER_TIERS_PATH.write_text(json.dumps(tiers), encoding="utf-8")
            persist_vehicle_inquiries_for_contact(
                "233555000111",
                [
                    {
                        "brand": "Hyundai",
                        "model": None,
                        "engine_code": "G4KD",
                        "year": 2012,
                        "part": None,
                        "mentioned_at": "t1",
                        "source_conversation_id": "c1",
                    },
                    {
                        "brand": "Toyota",
                        "model": None,
                        "engine_code": "1NZ",
                        "year": 2010,
                        "part": None,
                        "mentioned_at": "t2",
                        "source_conversation_id": "c1",
                    },
                ],
            )
            persist_vehicle_inquiries_for_contact(
                "杨浩安信",
                [
                    {
                        "brand": "Hyundai",
                        "model": None,
                        "engine_code": "G4KD",
                        "year": None,
                        "part": None,
                        "mentioned_at": "t3",
                        "source_conversation_id": "c2",
                    }
                ],
            )

            one = load_customer_crm_data("233555000111")
            self.assertTrue(one["available"])
            self.assertEqual(one["scope"], "single_customer")
            self.assertEqual(one["tier"]["value"], "潜在客户")
            self.assertEqual(one["distinct_engine_models_count"], 2)
            self.assertTrue(any("name-only" in x.lower() or "Name-only" in x for x in one["limitations"]))

            name_only = load_customer_crm_data("杨浩安信")
            self.assertTrue(name_only["available"])
            self.assertTrue(
                any("name-based" in x or "Name-only" in x or "cannot cross-reference" in x for x in name_only["limitations"])
            )

            agg = load_customer_crm_data(None)
            self.assertTrue(agg["available"])
            self.assertEqual(agg["scope"], "aggregate")
            brands = {r["name"]: r["count"] for r in agg["assortment"]["value"]["top_brands"]}
            self.assertGreaterEqual(brands.get("Hyundai", 0), 2)
            engines = {r["name"]: r["count"] for r in agg["assortment"]["value"]["top_engine_codes"]}
            self.assertGreaterEqual(engines.get("G4KD", 0), 2)
            self.assertTrue(agg["limitations"])


if __name__ == "__main__":
    unittest.main()
