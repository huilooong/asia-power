"""Phase 2 — persist per-contact tiers from history import."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from customer_gateway import sales_intelligence_paths as sip
from customer_gateway.contact_role_classifier import classify_contact_role, summarize_contact_roles


class CustomerTiersPersistTests(unittest.TestCase):
    def test_customer_tiers_json_matches_classifier(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            sip.reconfigure_paths(base)

            # Seed conversations directly (skip heavy archive import).
            convs = [
                {
                    "id": "c_a",
                    "contact": "233555000111",
                    "messages": [
                        {
                            "text": "Need Toyota G4KD engine price FOB",
                            "is_ceo": False,
                            "category": "enquiry",
                            "timestamp": "2026-01-01T10:00:00Z",
                        },
                        {
                            "text": "Also gearbox quote",
                            "is_ceo": False,
                            "category": "price_request",
                            "timestamp": "2026-01-02T10:00:00Z",
                        },
                    ],
                    "message_count": 2,
                },
                {
                    "id": "c_shallow",
                    "contact": "233555000222",
                    "messages": [
                        {"text": "Hi", "is_ceo": False, "category": "greeting", "timestamp": "2026-01-01T11:00:00Z"},
                    ],
                    "message_count": 1,
                },
                {
                    "id": "c_supplier",
                    "contact": "广州供应商仓库",
                    "messages": [
                        {
                            "text": "工厂 stock confirm 到货",
                            "is_ceo": False,
                            "category": "supplier_message",
                            "timestamp": "2026-01-01T12:00:00Z",
                        },
                    ],
                    "message_count": 1,
                },
            ]
            for c in convs:
                path = sip.CONVERSATIONS_DIR / f"{c['id']}.json"
                path.write_text(json.dumps(c, ensure_ascii=False), encoding="utf-8")

            # Mimic the persist step used by run_full_history_import (without re-importing archives).
            from customer_gateway.conversation_database import load_all_conversations

            all_convs = load_all_conversations()
            role_summary = summarize_contact_roles(all_convs)
            tiers_payload = {
                "updated_at": "test",
                "total_contacts": role_summary["total_contacts"],
                "customer_tiers": role_summary["customer_tiers"],
                "other_roles": role_summary["other_roles"],
                "effective_customers": role_summary["effective_customers"],
                "by_contact": role_summary["by_contact"],
            }
            sip.CUSTOMER_TIERS_PATH.write_text(
                json.dumps(tiers_payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

            saved = json.loads(sip.CUSTOMER_TIERS_PATH.read_text(encoding="utf-8"))
            self.assertIn("by_contact", saved)
            for conv in convs:
                contact = conv["contact"]
                expected = classify_contact_role(contact, conv["messages"])
                self.assertEqual(saved["by_contact"][contact], expected)
                self.assertEqual(role_summary["by_contact"][contact], expected)


if __name__ == "__main__":
    unittest.main()
