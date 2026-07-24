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

    def test_title_accurate_truck_engine(self):
        title = self.m.build_title(
            {
                "stockId": "HC250589",
                "brand": "Dongfeng",
                "model": "Tianlong",
                "year": 2013,
                "engineCode": "6bt",
                "truckPartType": "engine",
                "vehicleCategory": "truck",
                "slug": "dongfeng-tianlong-2013-6bt-truck-engine-hc250589",
            }
        )
        self.assertIn("Dongfeng", title)
        self.assertIn("Tianlong", title)
        self.assertIn("Truck Engine", title)
        self.assertIn("HC250589", title)
        self.assertNotIn("Half-Cut", title)

    def test_title_strips_chinese_model_uses_slug(self):
        title = self.m.build_title(
            {
                "stockId": "HC250588",
                "brand": "BMW",
                "model": "宝马X5(进口)",
                "year": 2006,
                "engineCode": "M54B30(306S3)",
                "vehicleCategory": "passenger",
                "slug": "bmw-x5-2006-m54b30-306s3-half-cut-hc250588",
            }
        )
        self.assertIn("BMW", title)
        self.assertIn("X5", title)
        self.assertNotRegex(title, r"[\u4e00-\u9fff]")
        self.assertIn("HC250588", title)

    def test_caption_variants(self):
        cab = self.m.build_caption(
            {
                "stockId": "HC250582",
                "brand": "Dongfeng",
                "model": "Tianlong",
                "year": "2024",
                "priceUsd": 28000,
                "slug": "dongfeng-2024-cab-truck-cab-hc250582",
                "truckPartType": "cab",
                "vehicleCategory": "truck",
                "engineCode": "ISLe",
                "transmissionCode": "12JS",
            }
        )
        self.assertIn("Truck Cab", cab)
        self.assertIn("28000 USD", cab)
        self.assertIn("/trucks/detail.html", cab)

        half = self.m.build_caption(
            {
                "stockId": "HC250552",
                "brand": "Volkswagen",
                "model": "Scirocco",
                "year": "2011",
                "priceUsd": 2500,
                "slug": "volkswagen-scirocco-2011-cdl-half-cut-hc250552",
                "vehicleCategory": "passenger",
                "engineCode": "CDL",
            }
        )
        self.assertIn("Half Cut", half)
        self.assertIn("/half-cuts/detail.html", half)

    def test_one_photo_or_video_eligible(self):
        one_photo = {
            "stockId": "ONE",
            "status": "Available",
            "brand": "Toyota",
            "model": "Corolla",
            "year": 2014,
            "slug": "toyota-corolla-2014-half-cut-one",
            "vehicleCategory": "passenger",
            "photos": [{"label": "Vehicle Front", "url": "/uploads/photos/a.jpg"}],
            "updatedAt": "2026-07-24T12:00:00Z",
        }
        video_only = {
            "stockId": "VID",
            "status": "Available",
            "brand": "Honda",
            "model": "Civic",
            "year": 2012,
            "slug": "honda-civic-2012-half-cut-vid",
            "vehicleCategory": "passenger",
            "photos": [],
            "video": {"sourceLocalPath": "/uploads/videos/v.mp4"},
            "updatedAt": "2026-07-24T11:00:00Z",
        }
        posted = {
            "stockId": "POSTED",
            "status": "Available",
            "brand": "Nissan",
            "slug": "nissan-posted",
            "photos": [{"url": "/uploads/photos/p.jpg"}],
        }
        cands = self.m.eligible_candidates([one_photo, video_only, posted], {"POSTED"})
        ids = [c["stockId"] for c in cands]
        self.assertEqual(ids, ["ONE", "VID"])  # newest first, posted excluded

    def test_select_skips_posted_and_diversifies_brand(self):
        items = [
            {
                "stockId": "A1",
                "status": "Available",
                "brand": "Toyota",
                "slug": "a1",
                "vehicleCategory": "passenger",
                "updatedAt": "2026-07-20T00:00:00Z",
                "photos": [
                    {"label": "Vehicle Front", "url": "/a1f.jpg"},
                ],
            },
            {
                "stockId": "B1",
                "status": "Available",
                "brand": "Honda",
                "slug": "b1",
                "vehicleCategory": "passenger",
                "updatedAt": "2026-07-21T00:00:00Z",
                "photos": [
                    {"label": "Vehicle Front", "url": "/b1f.jpg"},
                ],
            },
            {
                "stockId": "POSTED",
                "status": "Available",
                "brand": "Nissan",
                "slug": "p",
                "photos": [{"label": "Vehicle Front", "url": "/p1.jpg"}],
            },
        ]
        cands = self.m.eligible_candidates(items, {"POSTED"})
        ids = {c["stockId"] for c in cands}
        self.assertNotIn("POSTED", ids)
        picked = self.m.select_diverse(cands, 2)
        brands = {p["brand"] for p in picked}
        self.assertEqual(len(picked), 2)
        self.assertEqual(brands, {"Toyota", "Honda"})


if __name__ == "__main__":
    unittest.main()
