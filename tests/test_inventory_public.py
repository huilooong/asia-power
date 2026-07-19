"""Unit tests for sales_core.inventory_public (no live network)."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sales_core.inventory_public import (  # noqa: E402
    category_page_url,
    detail_page_url,
    find_inventory_matches,
    format_prepare_quote_reply,
    quote_within_self_authority,
    set_catalog_for_tests,
)


SAMPLE = [
    {
        "stockId": "HC999001",
        "slug": "toyota-rav4-2008-2az-fe-half-cut-hc999001",
        "title": "2008 Toyota RAV4 Half Cut",
        "brand": "Toyota",
        "model": "RAV4",
        "priceUsd": 1200,
        "status": "Available",
        "vehicleCondition": "Half Cut",
        "vehicleCategory": "Passenger",
        "engineCode": "2AZ-FE",
        "transmissionCode": "U241E",
    },
    {
        "stockId": "HC999002",
        "slug": "hyundai-engine-g4kd-hc999002",
        "title": "Hyundai G4KD Engine",
        "brand": "Hyundai",
        "model": "Tucson",
        "priceUsd": 900,
        "status": "Available",
        "vehicleCondition": "Engine Only",
        "vehicleCategory": "Passenger",
        "engineCode": "G4KD",
        "transmissionCode": "",
    },
]


def setup_function():
    set_catalog_for_tests(SAMPLE)


def teardown_function():
    set_catalog_for_tests(None)


def test_detail_and_category_urls():
    assert "half-cuts/detail.html?slug=" in (detail_page_url(SAMPLE[0]) or "")
    assert category_page_url("engine").endswith("/engines/")


def test_match_by_brand_model_and_engine():
    set_catalog_for_tests(SAMPLE)
    hits = find_inventory_matches(brand="Toyota", model="RAV4", catalog=SAMPLE)
    assert len(hits) == 1
    assert hits[0]["stock_id"] == "HC999001"
    assert hits[0]["price_usd"] == 1200
    assert hits[0]["detail_url"]

    eng = find_inventory_matches(engine_code="G4KD", part_intent="engine", catalog=SAMPLE)
    assert len(eng) == 1
    assert eng[0]["price_usd"] == 900


def test_prepare_quote_reply_uses_real_price():
    set_catalog_for_tests(SAMPLE)
    hits = find_inventory_matches(engine_code="G4KD", catalog=SAMPLE)
    text, needs = format_prepare_quote_reply(hits, part_intent="engine")
    assert needs is False
    assert "900 USD" in text
    assert "HC999002" in text
    assert "detail.html" in text


def test_prepare_quote_no_match_needs_confirmation():
    text, needs = format_prepare_quote_reply([], part_intent="engine")
    assert needs is True
    assert "no price number until confirmed" in text
    assert "/engines/" in text


def test_five_percent_authority():
    assert quote_within_self_authority(1000, 950) is True
    assert quote_within_self_authority(1000, 949) is False
