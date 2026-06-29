"""Tests for Conversation Learning Pipeline (APLIVE-004)."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from customer_gateway import conversation_paths as cp
from customer_gateway.conversation_analyzer import (
    analysis_exists,
    analyze_normalized,
    load_analysis,
)
from customer_gateway.conversation_learning_pipeline import process_live_message
from customer_gateway.conversation_normalizer import normalized_exists
from customer_gateway.conversation_paths import reconfigure_paths
from customer_gateway.conversation_raw_archive import archive_exists
from customer_gateway.gateway_readonly import (
    dispatch_conversations_command,
    dispatch_learning_command,
    reconfigure_paths as reconfigure_gateway_paths,
)
from customer_gateway.learning_candidate_queue import (
    approve_candidate,
    list_candidates,
    reject_candidate,
)
from customer_gateway.whatsapp_live_adapter import normalize_incoming
from tools import memory_tool


class ConversationLearningPipelineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        base = Path(self.tmp.name)
        reconfigure_paths(base / "memory")
        reconfigure_gateway_paths(base / "gateway")
        memory_tool.reconfigure_paths(base / "memory")

    def _process(self, message: str, contact: str) -> dict:
        msg = normalize_incoming(contact_name=contact, message=message)
        return process_live_message(msg, source="test")

    def test_customer_inquiry_full_pipeline(self) -> None:
        result = self._process("Do you have G4KJ engine price?", "Ghana Motors")
        mid = result["message_id"]
        self.assertTrue(archive_exists(mid))
        self.assertTrue(normalized_exists(mid))
        self.assertTrue(analysis_exists(mid))
        self.assertTrue(result["memory_candidate"])
        self.assertIsNotNone(result["candidate_id"])
        self.assertEqual(result["classification"], "customer_inquiry")

    def test_wheelsky_system_no_candidate(self) -> None:
        result = self._process(
            "Wheelsky 14 Inch Wheels trending products needs your attention",
            "Wheelsky",
        )
        mid = result["message_id"]
        self.assertTrue(archive_exists(mid))
        self.assertTrue(analysis_exists(mid))
        analysis = load_analysis(mid)
        assert analysis is not None
        self.assertIn(analysis["classification"], ("system_notification", "marketing_spam"))
        self.assertFalse(analysis["memory_candidate"])
        self.assertIsNone(result["candidate_id"])

    def test_private_message_no_candidate(self) -> None:
        result = self._process("晚上回家吃饭吗", "老婆")
        mid = result["message_id"]
        analysis = load_analysis(mid)
        assert analysis is not None
        self.assertTrue(analysis["private_signal"])
        self.assertFalse(analysis["memory_candidate"])
        self.assertIsNone(result["candidate_id"])

    def test_supplier_message_gets_candidate(self) -> None:
        result = self._process(
            "工厂今天有 G4KJ 库存确认，可以供货",
            "Guangzhou Supplier Factory",
        )
        mid = result["message_id"]
        analysis = load_analysis(mid)
        assert analysis is not None
        self.assertEqual(analysis["classification"], "supplier_message")
        self.assertTrue(analysis["supplier_signal"])
        self.assertTrue(result["memory_candidate"])
        self.assertIsNotNone(result["candidate_id"])

    def test_analysis_has_confidence_and_reason(self) -> None:
        result = self._process("Do you have G4KJ engine?", "Ghana Motors")
        analysis = load_analysis(result["message_id"])
        assert analysis is not None
        self.assertGreater(analysis["confidence"], 0)
        self.assertTrue(analysis["reason"])

    def test_approve_writes_memory_reject_does_not(self) -> None:
        result = self._process("Do you have G4KJ engine price?", "Ghana Motors")
        candidate_id = result["candidate_id"]
        assert candidate_id

        index_path = Path(self.tmp.name) / "memory" / "index.json"
        if index_path.is_file():
            index_before = len(json.loads(index_path.read_text())["entries"])
        else:
            index_before = 0

        approve_msg = dispatch_learning_command(f"/learning approve {candidate_id}")
        self.assertIn("已批准", approve_msg)

        index_after = json.loads((Path(self.tmp.name) / "memory" / "index.json").read_text())["entries"]
        self.assertGreater(len(index_after), index_before)

        result2 = self._process("Need 2KD engine monthly order from Ghana port", "Accra Trading Ltd")
        candidate_id2 = result2["candidate_id"]
        assert candidate_id2

        reject_msg = dispatch_learning_command(f"/learning reject {candidate_id2}")
        self.assertIn("已拒绝", reject_msg)
        self.assertFalse(any(cp.CANDIDATES_DIR.glob(f"{candidate_id2}.json")))

    def test_conversations_list_command(self) -> None:
        self._process("Do you have G4KJ?", "Ghana Motors")
        text = dispatch_conversations_command("/conversations list")
        self.assertIn("raw:", text)
        self.assertIn("analysis:", text)

    def test_conversations_analyze_pending(self) -> None:
        from customer_gateway.conversation_normalizer import save_normalized, normalize_from_payload

        payload = normalize_incoming(
            contact_name="Test Buyer",
            message="Looking for 1NZ engine",
        ).to_inbox_json()
        save_normalized(normalize_from_payload(payload))
        text = dispatch_conversations_command("/conversations analyze")
        self.assertIn("已分析", text)

    def test_normalized_read_only_flag(self) -> None:
        from customer_gateway import conversation_paths as cp

        self._process("Do you have G4KJ?", "Ghana Motors")
        norm_files = list(cp.NORMALIZED_DIR.glob("*.json"))
        self.assertTrue(norm_files)
        data = json.loads(norm_files[0].read_text())
        self.assertTrue(data["read_only"])

    def test_raw_archive_not_duplicate(self) -> None:
        from customer_gateway import conversation_paths as cp

        msg = normalize_incoming(contact_name="Ghana Motors", message="Do you have G4KJ?")
        r1 = process_live_message(msg, source="test")
        r2 = process_live_message(msg, source="test")
        self.assertTrue(r1["raw_archived"])
        self.assertFalse(r2["raw_archived"])
        raw_files = list(cp.RAW_DIR.rglob("*.json"))
        self.assertEqual(len(raw_files), 1)


if __name__ == "__main__":
    unittest.main()
