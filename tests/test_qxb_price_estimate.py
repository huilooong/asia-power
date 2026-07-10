"""Tests for QXB FOB price estimation."""

from __future__ import annotations

import unittest

from inventory_core.qxb_price_estimate import estimate_half_cut_price_usd


class QxbPriceEstimateTests(unittest.TestCase):
    def test_kia_rio_like_listing(self) -> None:
        listings = [
            {"brand": "Kia", "brandSlug": "kia", "model": "Rio", "year": 2012, "engineCode": "G4FA", "priceUsd": 850},
            {"brand": "Kia", "brandSlug": "kia", "model": "Cerato", "year": 2010, "engineCode": "G4ED", "priceUsd": 900},
            {"brand": "Toyota", "brandSlug": "toyota", "model": "Camry", "year": 2013, "engineCode": "1AZ-FE", "priceUsd": 5000},
        ]
        result = estimate_half_cut_price_usd(
            brand="Kia",
            brand_slug="kia",
            model="Rio",
            year=2007,
            engine_code="G4EE",
            api_base="https://example.com",
            listings=listings,
        )
        self.assertTrue(result["priceEstimated"])
        self.assertGreaterEqual(result["priceUsd"], 800)
        self.assertLessEqual(result["priceUsd"], 1000)
        self.assertEqual(result["method"], "catalog_median")


if __name__ == "__main__":
    unittest.main()
