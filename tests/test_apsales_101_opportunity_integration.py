"""APSALES-101 integration tests — see docs/cto/apsales-101-test-plan.md."""

from __future__ import annotations

import json
import re
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import mock

from apsales_runtime import paths as runtime_paths
from apsales_runtime.events import (
    ALL_EVENT_TYPES,
    EVENT_INQUIRY_RECEIVED,
    EVENT_OPPORTUNITY_CREATED,
    EVENT_OPPORTUNITY_UPDATED,
    EventBus,
)
from apsales_runtime.task_queue import TaskQueue
from analytics.provider import get_dashboard_bundle, get_sales_pipeline_metrics, get_traffic_metrics
from domain.opportunity import decision_stub
from domain.opportunity.identity import compute_customer_hash
from domain.opportunity.integration import handle_inquiry_received
from domain.opportunity import service as svc


class OpportunityTestBase(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        base = Path(self.tmp.name)
        svc.reconfigure_storage(base)
        runtime_paths.reconfigure_paths(base / "runtime")

    def tearDown(self) -> None:
        self.tmp.cleanup()


class INTOPPTests(OpportunityTestBase):
    def test_int_opp_001_create(self) -> None:
        result = handle_inquiry_received(
            {"channel": "whatsapp", "customer_name": "Kofi", "engine": "G4KD"},
        )
        self.assertEqual(result["action"], "created")
        opp = svc.find(result["opportunity_id"])
        assert opp is not None
        self.assertEqual(opp["sales_stage"], "Lead")
        self.assertEqual(opp["pipeline_stage"], "Inquiry")
        self.assertEqual(opp["outcome"]["result"], "open")

    def test_int_opp_002_id_format(self) -> None:
        result = handle_inquiry_received({"channel": "email", "customer_name": "Ada"})
        self.assertRegex(result["opportunity_id"], r"^OPP-\d{8}-EM-[a-f0-9]{6}$")

    def test_int_opp_003_merge(self) -> None:
        payload = {"channel": "email", "customer_name": "Ada", "engine": "2NZ-FE", "email": "a@test.com"}
        first = handle_inquiry_received(payload)
        second = handle_inquiry_received({**payload, "message": "follow up"})
        self.assertEqual(second["action"], "merged")
        self.assertEqual(second["opportunity_id"], first["opportunity_id"])
        self.assertEqual(len(list(svc.OPPORTUNITIES_DIR.glob("OPP-*.json"))), 1)

    def test_int_opp_004_different_engine(self) -> None:
        email = "a@test.com"
        r1 = handle_inquiry_received({"channel": "email", "email": email, "engine": "G4KD"})
        r2 = handle_inquiry_received({"channel": "email", "email": email, "engine": "2NZ-FE"})
        self.assertNotEqual(r1["opportunity_id"], r2["opportunity_id"])

    def test_int_opp_005_no_merge_closed(self) -> None:
        payload = {"channel": "email", "email": "b@test.com", "engine": "G4KD"}
        first = handle_inquiry_received(payload)
        svc.update(first["opportunity_id"], outcome={"result": "lost", "loss_reason": "", "closed_at": None, "actual_revenue": 0})
        second = handle_inquiry_received(payload)
        self.assertEqual(second["action"], "created")
        self.assertNotEqual(second["opportunity_id"], first["opportunity_id"])

    def test_int_opp_006_index_append(self) -> None:
        payload = {"channel": "email", "email": "c@test.com", "engine": "G4KD"}
        first = handle_inquiry_received(payload)
        handle_inquiry_received({**payload, "message": "again"})
        lines = [ln for ln in svc.INDEX_FILE.read_text(encoding="utf-8").splitlines() if ln.strip()]
        self.assertEqual(len(lines), 2)
        self.assertEqual(json.loads(lines[-1])["opportunity_id"], first["opportunity_id"])


class INTIDTests(OpportunityTestBase):
    def test_int_id_001_email_precedence(self) -> None:
        a = compute_customer_hash({"email": "Buyer@Test.COM", "customer_name": "X"})
        b = compute_customer_hash({"email": "buyer@test.com", "customer_name": "Y"})
        self.assertEqual(a, b)

    def test_int_id_002_phone_normalization(self) -> None:
        a = compute_customer_hash({"phone": "+233 54 091 1111", "channel": "whatsapp"})
        b = compute_customer_hash({"phone": "233540911111", "channel": "whatsapp"})
        self.assertEqual(a, b)

    def test_int_id_003_channel_handle(self) -> None:
        h = compute_customer_hash({"channel": "whatsapp", "phone": "+233540911111"})
        self.assertEqual(len(h), 16)

    def test_int_id_004_fallback_collision_guard(self) -> None:
        a = compute_customer_hash({"channel": "web", "customer_name": "unknown", "inquiry_id": "aaa"})
        b = compute_customer_hash({"channel": "web", "customer_name": "unknown", "inquiry_id": "bbb"})
        self.assertNotEqual(a, b)

    def test_int_id_005_explicit_hash(self) -> None:
        h = compute_customer_hash({"customer_hash": "precomputed-abc123"})
        self.assertEqual(h, "precomputed-abc123")


class INTRTTests(OpportunityTestBase):
    def test_int_rt_001_queue_enqueue(self) -> None:
        queue = TaskQueue()
        bus = EventBus()
        events: list[str] = []

        def on_inquiry(event):
            queue.enqueue("inquiry", event.payload, correlation_id=event.event_id)
            handle_inquiry_received(event.payload, event_id=event.event_id, publish=lambda t, p, c: events.append(t))

        bus.subscribe(EVENT_INQUIRY_RECEIVED, on_inquiry)
        bus.publish(EVENT_INQUIRY_RECEIVED, {"channel": "email", "email": "q@test.com"})
        self.assertEqual(len(queue.claim_next(batch_size=5)), 1)

    def test_int_rt_002_created_event(self) -> None:
        published: list[str] = []
        bus = EventBus()

        def on_inquiry(event):
            handle_inquiry_received(
                event.payload,
                event_id=event.event_id,
                publish=lambda t, p, c: published.append(t),
            )

        bus.subscribe(EVENT_INQUIRY_RECEIVED, on_inquiry)
        bus.publish(EVENT_INQUIRY_RECEIVED, {"channel": "email", "email": "new@test.com", "engine": "G4KD"})
        self.assertEqual(published, [EVENT_OPPORTUNITY_CREATED])

    def test_int_rt_003_updated_on_merge(self) -> None:
        published: list[str] = []
        payload = {"channel": "email", "email": "m@test.com", "engine": "G4KD"}

        def pub(t, p, c):
            published.append(t)

        handle_inquiry_received(payload, publish=pub)
        handle_inquiry_received({**payload, "message": "again"}, publish=pub)
        self.assertEqual(published, [EVENT_OPPORTUNITY_CREATED, EVENT_OPPORTUNITY_UPDATED])

    def test_int_rt_004_handler_failure_queue_ok(self) -> None:
        queue = TaskQueue()
        bus = EventBus()

        def on_inquiry(event):
            queue.enqueue("inquiry", event.payload, correlation_id=event.event_id)
            with mock.patch(
                "domain.opportunity.integration.handle_inquiry_received",
                side_effect=RuntimeError("boom"),
            ):
                try:
                    from domain.opportunity.integration import handle_inquiry_received as h
                    h(event.payload)
                except RuntimeError:
                    pass

        bus.subscribe(EVENT_INQUIRY_RECEIVED, on_inquiry)
        bus.publish(EVENT_INQUIRY_RECEIVED, {"channel": "email"})
        self.assertEqual(len(queue.claim_next(batch_size=5)), 1)

    def test_int_rt_005_event_types(self) -> None:
        self.assertIn(EVENT_OPPORTUNITY_CREATED, ALL_EVENT_TYPES)
        self.assertIn(EVENT_OPPORTUNITY_UPDATED, ALL_EVENT_TYPES)
        self.assertEqual(len(ALL_EVENT_TYPES), 11)


class INTDECTests(OpportunityTestBase):
    def test_int_dec_001_stub_fields(self) -> None:
        result = handle_inquiry_received({"channel": "web", "customer_name": "T"})
        stub = result["opportunity"]["decision_recommendation"]
        self.assertRegex(stub["decision_id"], r"^DEC-\d{8}-[a-f0-9]{6}$")
        self.assertEqual(stub["opportunity_id"], result["opportunity_id"])
        self.assertEqual(stub["status"], "pending")
        self.assertEqual(stub["decision"], "pending")
        self.assertEqual(stub["confidence"], 0)
        self.assertIn("APSALES-102", stub["reason"])

    def test_int_dec_002_decisions_jsonl(self) -> None:
        result = handle_inquiry_received({"channel": "web"})
        lines = decision_stub.DECISIONS_FILE.read_text(encoding="utf-8").strip().splitlines()
        self.assertEqual(len(lines), 1)
        row = json.loads(lines[0])
        self.assertEqual(row["decision_id"], result["opportunity"]["decision_recommendation"]["decision_id"])

    def test_int_dec_003_stub_unchanged_on_merge(self) -> None:
        payload = {"channel": "email", "email": "d@test.com", "engine": "G4KD"}
        first = handle_inquiry_received(payload)
        did = first["opportunity"]["decision_recommendation"]["decision_id"]
        second = handle_inquiry_received({**payload, "message": "x"})
        self.assertEqual(second["opportunity"]["decision_recommendation"]["decision_id"], did)


class INTLTests(OpportunityTestBase):
    def test_int_tl_001_append_on_create(self) -> None:
        result = handle_inquiry_received({"channel": "web"})
        types = [e["type"] for e in result["opportunity"]["events"]]
        self.assertEqual(types, ["InquiryReceived"])

    def test_int_tl_002_append_on_merge(self) -> None:
        payload = {"channel": "email", "email": "t@test.com", "engine": "G4KD"}
        first = handle_inquiry_received(payload)
        second = handle_inquiry_received({**payload, "message": "m"})
        types = [e["type"] for e in second["opportunity"]["events"]]
        self.assertEqual(types, ["InquiryReceived", "InquiryReceived"])

    def test_int_tl_003_append_event_api(self) -> None:
        result = handle_inquiry_received({"channel": "web"})
        svc.append_event(result["opportunity_id"], "VINDecoded", note="test")
        opp = svc.find(result["opportunity_id"])
        assert opp is not None
        self.assertEqual([e["type"] for e in opp["events"]], ["InquiryReceived", "VINDecoded"])


class INTANTests(OpportunityTestBase):
    def test_int_an_001_metrics_keys(self) -> None:
        handle_inquiry_received({"channel": "whatsapp", "customer_name": "Test"})
        metrics = get_sales_pipeline_metrics()
        for key in (
            "new_leads", "qualified", "quoted", "won", "lost",
            "pending", "urgent", "expected_revenue", "generated_at",
        ):
            self.assertIn(key, metrics)

    def test_int_an_002_new_leads_today(self) -> None:
        handle_inquiry_received({"channel": "web", "sales_stage": "Lead"})
        handle_inquiry_received({"channel": "web", "email": "x1@test.com"})
        handle_inquiry_received({"channel": "web", "email": "x2@test.com"})
        metrics = get_sales_pipeline_metrics()
        self.assertGreaterEqual(metrics["new_leads"], 2)

    def test_int_an_003_expected_revenue(self) -> None:
        r1 = handle_inquiry_received({"channel": "web", "email": "rev1@test.com", "expected_revenue": 1000})
        r2 = handle_inquiry_received({"channel": "web", "email": "rev2@test.com", "expected_revenue": 500})
        svc.update(r1["opportunity_id"], expected_revenue=1000)
        svc.update(r2["opportunity_id"], expected_revenue=500)
        lost = handle_inquiry_received({"channel": "web", "email": "rev3@test.com", "expected_revenue": 999})
        svc.update(lost["opportunity_id"], outcome={"result": "lost", "loss_reason": "", "closed_at": None, "actual_revenue": 0})
        metrics = get_sales_pipeline_metrics()
        self.assertEqual(metrics["expected_revenue"], 1500)

    def test_int_an_004_no_html_imports(self) -> None:
        import analytics.metrics.opportunity as mod
        src = Path(mod.__file__).read_text(encoding="utf-8")
        self.assertNotIn("flask", src.lower())
        self.assertNotIn("admin/", src)


class INTTRFTests(OpportunityTestBase):
    def test_int_trf_001_traffic_fields(self) -> None:
        result = handle_inquiry_received({
            "channel": "web",
            "landing_page": "/engines/hyundai-g4kd.html",
            "utm_source": "google",
            "utm_campaign": "g4kd-q2",
        })
        traffic = result["opportunity"]["traffic"]
        self.assertEqual(traffic["landing_page"], "/engines/hyundai-g4kd.html")
        self.assertEqual(traffic["utm_source"], "google")
        self.assertEqual(traffic["engine_slug"], "hyundai-g4kd")

    def test_int_trf_002_traffic_preserved_on_merge(self) -> None:
        payload = {
            "channel": "web",
            "email": "trf@test.com",
            "engine": "G4KD",
            "landing_page": "/engines/hyundai-g4kd.html",
        }
        first = handle_inquiry_received(payload)
        second = handle_inquiry_received({"channel": "web", "email": "trf@test.com", "engine": "G4KD", "message": "hi"})
        self.assertEqual(second["opportunity"]["traffic"], first["opportunity"]["traffic"])

    def test_int_trf_003_landing_page_metric(self) -> None:
        handle_inquiry_received({"channel": "web", "email": "a1", "landing_page": "/engines/a.html"})
        handle_inquiry_received({"channel": "web", "email": "a2", "landing_page": "/engines/a.html"})
        handle_inquiry_received({"channel": "web", "email": "a3", "landing_page": "/engines/b.html"})
        metrics = get_traffic_metrics()
        self.assertEqual(metrics["inquiries_by_landing_page"]["/engines/a.html"], 2)
        self.assertEqual(metrics["inquiries_by_landing_page"]["/engines/b.html"], 1)

    def test_int_trf_004_engine_slug_metric(self) -> None:
        handle_inquiry_received({"channel": "web", "email": "e1", "landing_page": "/engines/hyundai-g4kd.html"})
        handle_inquiry_received({"channel": "web", "email": "e2", "landing_page": "/engines/toyota-2nz-fe.html"})
        handle_inquiry_received({"channel": "web", "email": "e3", "landing_page": "/engines/hyundai-g4kd.html"})
        metrics = get_traffic_metrics()
        self.assertEqual(metrics["inquiries_by_engine_slug"]["hyundai-g4kd"], 2)

    def test_int_trf_005_organic_paid_ratio(self) -> None:
        handle_inquiry_received({"channel": "web", "email": "o1", "entry_channel": "organic"})
        handle_inquiry_received({"channel": "web", "email": "o2", "entry_channel": "organic"})
        handle_inquiry_received({"channel": "web", "email": "o3", "entry_channel": "organic"})
        handle_inquiry_received({"channel": "web", "email": "p1", "entry_channel": "paid"})
        metrics = get_traffic_metrics()
        self.assertEqual(metrics["organic_vs_paid_ratio"]["organic"], 0.75)
        self.assertEqual(metrics["organic_vs_paid_ratio"]["paid"], 0.25)


class INTREGTests(unittest.TestCase):
    def test_int_reg_001_runtime_foundation_import(self) -> None:
        from apsales_runtime.events import ALL_EVENT_TYPES as types
        self.assertEqual(len(types), 11)

    def test_int_reg_002_dashboard_bundle(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            svc.reconfigure_storage(Path(tmp))
            bundle = get_dashboard_bundle()
            self.assertIn("sales_pipeline", bundle)
            self.assertIn("traffic", bundle)


if __name__ == "__main__":
    unittest.main()
