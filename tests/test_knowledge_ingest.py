"""Tests for shared upload knowledge ingest."""

import json
import tempfile
import unittest
from pathlib import Path

from tools import knowledge_ingest, memory_tool


SAMPLE = {
    "stockId": "QXB0001",
    "submissionId": "QXB-0001",
    "vin": "LGBN22E28AY002810",
    "brand": "Nissan",
    "brandSlug": "nissan",
    "model": "March",
    "year": 2010,
    "decodeMethod": "QXB OCR",
    "decodeConfidence": "0.92",
    "vehicleCondition": "Half Cut",
    "vehicleCategory": "passenger",
    "supplierName": "汽修宝",
    "supplierVerified": True,
    "title": "Nissan March Half Cut",
    "photos": [
        {"label": "Front view", "url": "https://example.com/1.jpg"},
        {"label": "VIN / chassis plate", "url": "https://example.com/2.jpg"},
    ],
    "qxb": {
        "row": 1,
        "brandCn": "日产",
        "modelKey": "玛驰",
        "description": "测试说明",
    },
}


class KnowledgeIngestTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        kb = root / "kb"
        kb.mkdir()
        knowledge_ingest.reconfigure_paths(kb_dir=kb)
        memory_tool.reconfigure_paths(root / "memory")

    def test_ingest_creates_sourced_entry(self) -> None:
        result = knowledge_ingest.ingest_listing_record(SAMPLE, source_ref="test#QXB0001")
        self.assertTrue(result["created"])
        store = json.loads(knowledge_ingest.UPLOAD_LEARNINGS.read_text(encoding="utf-8"))
        self.assertEqual(len(store["entries"]), 1)
        entry = store["entries"][0]
        self.assertEqual(entry["source"], "qxb_upload")
        self.assertIn("inventory", entry["tags"])
        self.assertEqual(entry["facts"]["stockId"], "QXB0001")
        self.assertEqual(entry["agents"], ["*"])

    def test_ingest_updates_existing_stock(self) -> None:
        knowledge_ingest.ingest_listing_record(SAMPLE)
        updated = dict(SAMPLE)
        updated["model"] = "March Updated"
        result = knowledge_ingest.ingest_listing_record(updated)
        self.assertFalse(result["created"])
        store = json.loads(knowledge_ingest.UPLOAD_LEARNINGS.read_text(encoding="utf-8"))
        self.assertEqual(len(store["entries"]), 1)
        self.assertEqual(store["entries"][0]["facts"]["model"], "March Updated")

    def test_enrich_model_dictionary_additive(self) -> None:
        knowledge_ingest.MODEL_DICT.write_text(json.dumps({"nissan": {}}), encoding="utf-8")
        knowledge_ingest.ingest_listing_record(SAMPLE)
        md = json.loads(knowledge_ingest.MODEL_DICT.read_text(encoding="utf-8"))
        self.assertIn("玛驰", md["nissan"])
        self.assertEqual(md["nissan"]["玛驰"]["source"], "upload_ingest")

    def test_search_and_context_snippet(self) -> None:
        knowledge_ingest.ingest_listing_record(SAMPLE)
        hits = knowledge_ingest.search("march")
        self.assertEqual(len(hits), 1)
        snippet = knowledge_ingest.format_context_snippet("QXB0001")
        self.assertIn("Upload knowledge", snippet)
        self.assertIn("QXB0001", snippet)

    def test_batch_sync_from_file(self) -> None:
        path = Path(self.tmp.name) / "import.json"
        path.write_text(json.dumps([SAMPLE]), encoding="utf-8")
        summary = knowledge_ingest.sync_from_import_file(path)
        self.assertEqual(summary["total"], 1)
        self.assertEqual(summary["created"], 1)


if __name__ == "__main__":
    unittest.main()
