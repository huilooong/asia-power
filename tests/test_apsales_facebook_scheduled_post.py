"""Unit tests for Facebook scheduled post selection / caption (no live Graph calls)."""

from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "apsales-facebook-scheduled-post.py"


def load_mod():
    spec = importlib.util.spec_from_file_location("apsales_facebook_scheduled_post", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(mod)
    return mod


class FacebookScheduledPostTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.m = load_mod()

    def test_caption_variants(self):
        cab = self.m.build_caption(
            {
                "brand": "Dongfeng",
                "model": "东风",
                "year": "2024",
                "priceUsd": 28000,
                "slug": "dongfeng-2024-cab-truck-cab-hc250582",
                "truckPartType": "cab",
                "vehicleCategory": "truck",
                "engineCode": "康明斯",
                "transmissionCode": "14档",
            }
        )
        self.assertIn("Truck Cab", cab)
        self.assertIn("28000 USD", cab)
        self.assertIn("driver cab", cab.lower())

        half = self.m.build_caption(
            {
                "brand": "Volkswagen",
                "model": "Scirocco",
                "year": "2011",
                "priceUsd": 2500,
                "slug": "volkswagen-scirocco-2011-cdl-half-cut-hc250552",
                "vehicleCategory": "passenger",
                "engineCode": "CDL",
            }
        )
        self.assertIn("Half-Cut, Ready to Dismantle", half)
        self.assertIn("custom dismantle", half.lower())

    def test_select_skips_posted_and_diversifies_brand(self):
        items = [
            {
                "stockId": "A1",
                "status": "Available",
                "brand": "Toyota",
                "slug": "a1",
                "vehicleCategory": "passenger",
                "photos": [
                    {"label": "Vehicle Front", "url": "/a1f.jpg"},
                    {"label": "Engine", "url": "/a1e.jpg"},
                    {"label": "Interior", "url": "/a1i.jpg"},
                    {"label": "VIN Plate", "url": "/a1v.jpg"},
                ],
            },
            {
                "stockId": "A2",
                "status": "Available",
                "brand": "Toyota",
                "slug": "a2",
                "vehicleCategory": "passenger",
                "photos": [
                    {"label": "Photo 01", "url": "/a2-1.jpg"},
                    {"label": "Photo 02", "url": "/a2-2.jpg"},
                    {"label": "Photo 03", "url": "/a2-3.jpg"},
                    {"label": "Photo 04", "url": "/a2-4.jpg"},
                ],
            },
            {
                "stockId": "B1",
                "status": "Available",
                "brand": "Honda",
                "slug": "b1",
                "vehicleCategory": "passenger",
                "photos": [
                    {"label": "Vehicle Front", "url": "/b1f.jpg"},
                    {"label": "Engine", "url": "/b1e.jpg"},
                    {"label": "Interior", "url": "/b1i.jpg"},
                    {"label": "VIN Plate", "url": "/b1v.jpg"},
                ],
            },
            {
                "stockId": "POSTED",
                "status": "Available",
                "brand": "Nissan",
                "slug": "p",
                "photos": [
                    {"label": "Vehicle Front", "url": "/p1.jpg"},
                    {"label": "Engine", "url": "/p2.jpg"},
                    {"label": "Interior", "url": "/p3.jpg"},
                    {"label": "VIN Plate", "url": "/p4.jpg"},
                ],
            },
        ]
        cands = self.m.eligible_candidates(items, {"POSTED"})
        ids = {c["stockId"] for c in cands}
        self.assertNotIn("POSTED", ids)
        self.assertIn("A1", ids)
        picked = self.m.select_diverse(cands, 2)
        brands = {p["brand"] for p in picked}
        self.assertEqual(len(picked), 2)
        self.assertEqual(brands, {"Toyota", "Honda"})


if __name__ == "__main__":
    unittest.main()
