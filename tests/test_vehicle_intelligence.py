"""APSALES-AUTOINTELLIGENCE-001 — Vehicle Intelligence unit tests."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from sales_core.vehicle_intelligence import (
    VehicleSnapshot,
    _nhtsa_flat_to_snapshot,
    build_sales_decision,
    build_whatsapp_reply,
    enrich_from_vin,
    extract_vin,
    write_knowledge,
)


class VehicleIntelligenceTests(unittest.TestCase):
    def test_extract_vin(self):
        self.assertEqual(extract_vin("VIN is 1HGCM82633A004352 please"), "1HGCM82633A004352")

    def test_knowledge_first_skips_external(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            snap = VehicleSnapshot(
                vin="1HGCM82633A004352",
                vin_masked="1HG****4352",
                brand="HONDA",
                model="Accord",
                year="2003",
                provider_source="asia_power_store",
                source="asia_power_store",
                confidence="high",
                verification_status="verified",
                ok=True,
            )
            write_knowledge(snap, root, reason="test")
            with mock.patch("sales_core.vehicle_intelligence.fetch_nhtsa") as mocked:
                hit = enrich_from_vin("1HGCM82633A004352", root=root)
                mocked.assert_not_called()
            self.assertTrue(hit.knowledge_hit)
            self.assertEqual(hit.brand, "HONDA")
            self.assertEqual(hit.model, "Accord")

    def test_decision_does_not_reask_known_identity(self):
        snap = VehicleSnapshot(
            vin="1HGCM82633A004352",
            vin_masked="1HG****4352",
            brand="HONDA",
            model="Accord",
            year="2003",
            engine_code="",
            ok=True,
            provider_source="asia_power_store",
            source="asia_power_store",
            confidence="high",
            verification_status="verified",
            knowledge_hit=True,
        )
        result = build_sales_decision(snap, "1HGCM82633A004352")
        self.assertIn("brand", result.do_not_ask)
        self.assertIn("model", result.do_not_ask)
        self.assertIn("year", result.do_not_ask)
        self.assertIn("product_scope", result.ask_keys)
        self.assertIn("quantity", result.ask_keys)
        self.assertIn("destination_port", result.ask_keys)
        reply = build_whatsapp_reply(result)
        self.assertIn("Identified:", reply)
        self.assertIn("HONDA", reply)
        self.assertIn("1HG****4352", reply)
        self.assertNotIn("Dear Customer", reply)
        self.assertNotIn("Please send:\n• VIN", reply)

    def test_nhtsa_writeback(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            fake = VehicleSnapshot(
                vin="1HGCM82633A004352",
                vin_masked="1HG****4352",
                brand="HONDA",
                model="Accord",
                year="2003",
                provider_source="nhtsa_vpic",
                source="nhtsa_vpic",
                confidence="high",
                verification_status="provider_reported",
                ok=True,
            )
            with mock.patch("sales_core.vehicle_intelligence.fetch_nhtsa", return_value=fake):
                first = enrich_from_vin("1HGCM82633A004352", root=root)
            self.assertEqual(first.provider_source, "nhtsa_vpic")
            self.assertEqual(first.verification_status, "provider_reported")
            cache = json.loads((root / "data" / "vehicle_knowledge" / "vin-cache.json").read_text())
            self.assertIn("1HGCM82633A004352", cache)
            self.assertEqual(cache["1HGCM82633A004352"]["verification_status"], "provider_reported")
            second = enrich_from_vin("1HGCM82633A004352", root=root, allow_external=False)
            self.assertTrue(second.knowledge_hit)

    def test_nhtsa_displacement_field(self):
        snap = _nhtsa_flat_to_snapshot(
            "1N4AL3AP8JC123456",
            {
                "Make": "NISSAN",
                "Model": "Altima",
                "ModelYear": "2018",
                "EngineModel": "",
                "DisplacementL": "2.5",
                "ErrorCode": "0",
            },
        )
        self.assertEqual(snap.displacement, "2.5L")
        self.assertIn("displacement", snap.to_public_dict())
        empty = _nhtsa_flat_to_snapshot(
            "X",
            {
                "Make": "NISSAN",
                "Model": "Hardbody",
                "ModelYear": "2021",
                "EngineModel": "YD25",
                "DisplacementL": "",
                "ErrorCode": "0",
            },
        )
        self.assertEqual(empty.displacement, "")


if __name__ == "__main__":
    unittest.main()
