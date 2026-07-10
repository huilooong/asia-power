"""Tests for test/bot email filter."""

from customer_gateway.email_test_filter import is_test_or_bot_email, is_test_or_bot_thread


def test_buyer_test_com():
    assert is_test_or_bot_email("buyer@test.com")


def test_ceo_test_local():
    assert is_test_or_bot_email("ceo-test@asiapower.local")


def test_real_gmail_not_test():
    assert not is_test_or_bot_email("markfinley280399@gmail.com")


def test_cloudflare_thread():
    thread = {
        "subject": "Cloudflare live test",
        "messages": [{"direction": "inbound", "from": "buyer@test.com", "text": "Need 3 G4KJ"}],
    }
    assert is_test_or_bot_thread(thread)
