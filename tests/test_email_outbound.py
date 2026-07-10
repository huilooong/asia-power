"""Tests for Phase 2 email outbound."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest

from customer_gateway import email_outbound as eo


def test_reply_subject():
    assert eo.reply_subject("Need quote") == "Re: Need quote"
    assert eo.reply_subject("Re: Need quote") == "Re: Need quote"


def test_send_enabled(monkeypatch):
    monkeypatch.delenv("EMAIL_SEND_ENABLED", raising=False)
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    assert eo.send_enabled() is False
    monkeypatch.setenv("EMAIL_SEND_ENABLED", "1")
    monkeypatch.setenv("RESEND_API_KEY", "re_test")
    assert eo.send_enabled() is True


def test_thread_id_from_draft():
    d = {"chat_id": "em-abc123", "customer_name": "email:em-abc123 buyer@test.com"}
    assert eo.thread_id_from_draft(d) == "em-abc123"


@patch("customer_gateway.email_outbound._resend_send")
def test_send_email_draft(mock_resend, tmp_path, monkeypatch):
    monkeypatch.setenv("EMAIL_SEND_ENABLED", "1")
    monkeypatch.setenv("RESEND_API_KEY", "re_test")

    threads_file = tmp_path / "email-threads.json"
    threads_file.write_text(
        json.dumps(
            {
                "threads": [
                    {
                        "threadId": "em-test01",
                        "subject": "Toyota 2AZ",
                        "mailbox": "inquiry",
                        "proxyReplyTo": "reply+em-test01@asia-power.com",
                        "messages": [
                            {
                                "direction": "inbound",
                                "from": "buyer@example.com",
                                "messageId": "<in@test>",
                            }
                        ],
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(eo, "EMAIL_THREADS_FILE", threads_file)

    draft_dir = tmp_path / "drafts"
    draft_dir.mkdir()
    monkeypatch.setattr("customer_gateway.gateway_readonly.DRAFT_QUEUE_DIR", draft_dir)

    draft_id = "draft-test001"
    draft = {
        "draft_id": draft_id,
        "channel": "email",
        "chat_id": "em-test01",
        "status": "approved",
        "customer_reply_draft": "Thank you for your enquiry.",
    }
    (draft_dir / f"{draft_id}.json").write_text(json.dumps(draft), encoding="utf-8")

    mock_resend.return_value = {"id": "resend-xyz"}

    result = eo.send_email_draft(draft_id)
    assert result["ok"] is True
    assert result["to"] == "buyer@example.com"
    assert result["resend_id"] == "resend-xyz"

    updated = json.loads((draft_dir / f"{draft_id}.json").read_text())
    assert updated["status"] == "sent"

    thread_data = json.loads(threads_file.read_text())
    msgs = thread_data["threads"][0]["messages"]
    assert any(m.get("direction") == "outbound" for m in msgs)
