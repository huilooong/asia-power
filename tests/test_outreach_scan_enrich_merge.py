"""Track C: HC inventory enrich + same-email merge for outreach scan."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest import mock

from customer_gateway import outreach_engine
from customer_gateway.outreach_engine import (
    build_lead_followup_email,
    build_outreach_enquiry,
    draft_has_cjk,
    email_subject_for_candidate,
    enrich_lead_vehicle_fields,
    extract_hc_id_from_page_url,
    sanitize_customer_product_label,
    scan_outreach_candidates,
)


class ExtractHcIdTests(unittest.TestCase):
    def test_extracts_stock_from_detail_slug(self):
        url = "/half-cuts/detail.html?slug=hyundai-sonata-2011-g4ke-half-cut-hc250194"
        self.assertEqual(extract_hc_id_from_page_url(url), "HC250194")

    def test_empty_when_no_hc_token(self):
        self.assertEqual(extract_hc_id_from_page_url("/engines/?q=2zr-fe"), "")


class EnrichLeadTests(unittest.TestCase):
    def setUp(self):
        outreach_engine.clear_half_cut_index_cache()

    def tearDown(self):
        outreach_engine.clear_half_cut_index_cache()

    def test_pageurl_hc_fills_brand_model_via_inventory_lookup(self):
        fake_row = {
            "stockId": "HC250194",
            "brand": "Hyundai",
            "model": "Sonata",
            "year": 2011,
            "engineCode": "G4KE",
        }
        lead = {
            "id": "lead-tom",
            "name": "Tom",
            "email": "tom@example.com",
            "brand": "",
            "model": "",
            "product": "",
            "engineCode": "",
            "pageUrl": "/half-cuts/detail.html?slug=hyundai-sonata-2011-g4ke-half-cut-hc250194",
        }
        with mock.patch.object(
            outreach_engine, "lookup_half_cut_by_hc", return_value=fake_row
        ) as lookup:
            out = enrich_lead_vehicle_fields(lead)
        lookup.assert_called_once_with("HC250194")
        self.assertEqual(out["hc_id"], "HC250194")
        self.assertEqual(out["brand"], "Hyundai")
        self.assertEqual(out["model"], "Sonata")
        self.assertEqual(out["engine_code"], "G4KE")
        self.assertIn("HC250194", out["product"])
        self.assertIn("Hyundai", out["product"])
        self.assertIn("Sonata", out["product"])

    def test_does_not_invent_when_lookup_misses(self):
        lead = {
            "pageUrl": "/half-cuts/detail.html?slug=missing-unit-hc259999",
            "brand": "",
            "model": "",
            "product": "",
        }
        with mock.patch.object(outreach_engine, "lookup_half_cut_by_hc", return_value=None):
            out = enrich_lead_vehicle_fields(lead)
        self.assertEqual(out["hc_id"], "HC259999")
        self.assertEqual(out["brand"], "")
        self.assertEqual(out["model"], "")
        self.assertEqual(out["product"], "HC259999")


class MergeEmailCandidatesTests(unittest.TestCase):
    def setUp(self):
        outreach_engine.clear_half_cut_index_cache()

    def tearDown(self):
        outreach_engine.clear_half_cut_index_cache()

    def test_same_email_three_products_become_one_candidate(self):
        leads = [
            {
                "id": "a1",
                "name": "Godson",
                "email": "sitesdomreg@gmail.com",
                "country": "ghana",
                "product": "HC250268 (Toyota Corolla 1ZR-FE)",
                "intent": "quote",
                "replyStatus": "open",
            },
            {
                "id": "a2",
                "name": "Godson",
                "email": " Sitesdomreg@gmail.com ",
                "country": "ghana",
                "product": "HC250489 (Toyota RAV4 2AZ-FE)",
                "intent": "quote",
            },
            {
                "id": "a3",
                "name": "Godson",
                "email": "sitesdomreg@gmail.com",
                "product": "2ZR-FE",
                "intent": "enquiry",
            },
        ]
        with mock.patch.object(outreach_engine, "_load_leads", return_value=leads):
            with mock.patch.object(
                outreach_engine, "lookup_half_cut_by_hc", return_value=None
            ):
                # Avoid WhatsApp profile side effects
                with mock.patch.dict("sys.modules", {"customer_gateway.customer_profile_builder": None}):
                    out = scan_outreach_candidates(limit=50)

        website = [c for c in out if c.get("source") == "website_lead"]
        self.assertEqual(len(website), 1, website)
        cand = website[0]
        self.assertEqual(cand["merged_lead_count"], 3)
        self.assertTrue(cand.get("multi_listing"))
        self.assertIn("HC250268", cand["product"])
        self.assertIn("HC250489", cand["product"])
        self.assertIn("2ZR-FE", cand["product"])
        self.assertEqual(len(cand["ref_ids"]), 3)

    def test_enquiry_brief_mentions_specific_hc_listing(self):
        q = build_outreach_enquiry(
            {
                "name": "Tom",
                "country": "ghana",
                "product": "HC250194 (Hyundai Sonata G4KE)",
                "brand": "Hyundai",
                "model": "Sonata",
                "engine_code": "G4KE",
                "hc_id": "HC250194",
                "message": "",
            }
        )
        self.assertIn("HC250194", q)
        self.assertIn("Hyundai Sonata", q)
        self.assertIn("half-cut listing page", q)
        self.assertIn("do NOT ask a vague", q)

    def test_enquiry_brief_covers_multi_listing(self):
        q = build_outreach_enquiry(
            {
                "name": "Godson",
                "country": "ghana",
                "product": "A, B",
                "multi_listing": True,
                "listing_labels": ["HC1 (Toyota)", "HC2 (RAV4)"],
                "message": "",
            }
        )
        self.assertIn("several different listings", q)
        self.assertIn("ONE email", q)
        self.assertIn("HC1 (Toyota)", q)


class EnCustomerProductCjkGateTests(unittest.TestCase):
    """EN buyers must not receive CJK that leaked in from raw product fields."""

    def test_sanitize_strips_cjk_keeps_english_tokens(self):
        raw = "HC250087 (Hyundai ix35 G4KE), Hyundai 胜达经典 G4KE"
        out = sanitize_customer_product_label(raw, lang="en")
        self.assertFalse(draft_has_cjk(out))
        self.assertIn("HC250087", out)
        self.assertIn("Hyundai", out)
        self.assertIn("G4KE", out)
        self.assertNotIn("胜达", out)

    def test_subject_and_template_body_reject_cjk_product(self):
        cand = {
            "name": "Fabian Danku",
            "country": "ghana",
            "email": "fabiandanku@yahoo.com",
            "product": (
                "HC250087 (Hyundai ix35 G4KE), HC250306 (Hyundai Santa Fe G4KC), "
                "Hyundai 胜达经典 G4KE"
            ),
        }
        subject = email_subject_for_candidate(cand)
        subject2, body = build_lead_followup_email(cand)
        self.assertFalse(draft_has_cjk(subject), subject)
        self.assertFalse(draft_has_cjk(subject2), subject2)
        self.assertFalse(draft_has_cjk(body), body)
        self.assertIn("HC250087", subject)
        self.assertIn("HC250087", body)


if __name__ == "__main__":
    unittest.main()
