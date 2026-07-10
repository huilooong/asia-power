"""Tests for CEO email approval reply parsing."""

from customer_gateway.ceo_draft_approval import _ceo_reply_body, try_handle_ceo_approval
from unittest.mock import patch


def test_strip_gmail_quote_keeps_agree_only():
    body = (
        "同意\r\n\r\n"
        "AsiaPower Sales <sales@asia-power.com> 于 2026年7月3日写道：\r\n\r\n"
        "> 拒绝请回复：拒绝 draft-2026-07-03T1926TUTC-f18e507b\r\n"
    )
    assert _ceo_reply_body(body) == "同意"


def test_approve_not_rejected_by_quoted_text():
    thread = {
        "threadId": "em-test",
        "subject": "[子敬待批 draft-abc]",
        "messages": [{
            "direction": "inbound",
            "from": "weylonhui@gmail.com",
            "text": (
                "同意\n\nAsiaPower Sales 写道：\n> 拒绝请回复：拒绝 draft-abc\n"
            ),
        }],
    }
    draft = {"draft_id": "draft-abc", "status": "pending", "channel": "email", "customer_name": "email:em-x"}
    with patch("customer_gateway.ceo_draft_approval.get_email_thread", return_value=thread), patch(
        "customer_gateway.ceo_draft_approval.latest_inbound_text", return_value=thread["messages"][0]["text"]
    ), patch("customer_gateway.ceo_draft_approval.load_draft", return_value=draft), patch(
        "customer_gateway.ceo_draft_approval.approve_draft", return_value={"_send_result": {"ok": True, "draft_id": "draft-abc", "to": "a@b.com", "from": "sales@", "subject": "Re:", "resend_id": "r1"}}
    ) as approve:
        msg = try_handle_ceo_approval("em-test")
    approve.assert_called_once()
    assert "已发送" in msg or "r1" in msg
