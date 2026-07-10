"""Tests for inbound email webhook auto-process."""

from __future__ import annotations

import json
from unittest.mock import patch

import pytest

from customer_gateway import email_webhook_handler as wh


def test_skips_non_apsales_agent():
    thread = {"threadId": "em-test", "mailbox": "supplier", "messages": [{"direction": "inbound", "from": "s@x.com", "text": "hi"}]}
    with patch.object(wh, "try_handle_ceo_approval", return_value=None), patch.object(
        wh, "get_email_thread", return_value=thread
    ), patch.object(wh, "agent_for_thread", return_value="apinventory"):
        out = wh.handle_inbound_email_webhook("em-test")
    assert out["kind"] == "skip"
    assert out["reason"] == "agent_apinventory"


def test_ceo_approval_takes_priority():
    with patch.object(wh, "try_handle_ceo_approval", return_value="已发送"):
        out = wh.handle_inbound_email_webhook("em-ceo")
    assert out["kind"] == "ceo_approval"
    assert "已发送" in out["message"]


def test_auto_draft_for_apsales():
    thread = {
        "threadId": "em-buyer",
        "mailbox": "inquiry",
        "messages": [{"direction": "inbound", "from": "buyer@test.com", "text": "Need engines"}],
    }
    draft = {"draft_id": "draft-test-123"}
    with patch.object(wh, "try_handle_ceo_approval", return_value=None), patch.object(
        wh, "get_email_thread", return_value=thread
    ), patch.object(wh, "agent_for_thread", return_value="apsales"), patch.object(
        wh, "process_email_thread", return_value=draft
    ) as proc:
        out = wh.handle_inbound_email_webhook("em-buyer")
    proc.assert_called_once_with("em-buyer")
    assert out["kind"] == "draft"
    assert out["draft_id"] == "draft-test-123"
