from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest

from agents.apbd.solo_trade.enrichment import ApolloClient, HunterClient
from agents.apbd.solo_trade.gmail import GmailClient, SendLedger, build_raw_message
from agents.apbd.solo_trade.models import CampaignBrief, ExternalApproval
from agents.apbd.solo_trade.service import SoloTradeService
from agents.apbd.solo_trade.storage import CampaignStore


class FakeTransport:
    def __init__(self, response: dict) -> None:
        self.response = response
        self.calls: list[dict] = []

    def request(self, method: str, url: str, *, headers: dict[str, str], payload: dict | None = None) -> dict:
        self.calls.append({"method": method, "url": url, "headers": headers, "payload": payload})
        return self.response


def test_hunter_requires_opt_in_and_uses_header() -> None:
    transport = FakeTransport({"data": {"organization": "Example", "emails": [{"value": "buyer@example.test", "confidence": 92, "verification": {"status": "valid"}}]}})
    with pytest.raises(PermissionError, match="opt-in"):
        HunterClient("secret", transport=transport).domain_search("example.test")
    result = HunterClient("secret", transport=transport, paid_opt_in=True).domain_search("https://example.test/path")
    assert result["contacts"][0]["verified"] is True
    assert transport.calls[0]["headers"]["X-API-KEY"] == "secret"
    assert "secret" not in transport.calls[0]["url"]


def test_hunter_account_returns_only_plan_and_usage() -> None:
    transport = FakeTransport(
        {
            "data": {
                "first_name": "Private",
                "email": "private@example.test",
                "plan_name": "Free",
                "requests": {
                    "searches": {"used": 2, "available": 50, "remaining": 48},
                    "verifications": {"used": 0, "available": 100, "remaining": 100},
                },
            }
        }
    )
    account = HunterClient("secret", transport=transport).account()
    assert account == {
        "provider": "hunter",
        "plan": "Free",
        "usage": {
            "searches": {"used": 2, "available": 50, "remaining": 48},
            "verifications": {"used": 0, "available": 100, "remaining": 100},
        },
    }
    assert transport.calls[0]["url"].endswith("/account")
    assert transport.calls[0]["headers"]["X-API-KEY"] == "secret"


def test_apollo_requires_key_and_uses_documented_search_path() -> None:
    with pytest.raises(PermissionError, match="APOLLO_API_KEY"):
        ApolloClient("", transport=FakeTransport({}), paid_opt_in=True).organization_search(["engine"])
    transport = FakeTransport({"organizations": [{"name": "Example"}]})
    result = ApolloClient("secret", transport=transport, paid_opt_in=True).organization_search(["engine importer"])
    assert result["organizations"][0]["name"] == "Example"
    assert transport.calls[0]["url"].endswith("/mixed_companies/search")
    assert transport.calls[0]["headers"]["x-api-key"] == "secret"


def test_gmail_draft_builds_base64url_mime() -> None:
    raw = build_raw_message(sender="sales@example.test", recipient="buyer@example.test", subject="Hello", body="Reply Sure")
    assert "+" not in raw and "/" not in raw
    transport = FakeTransport({"id": "draft-1", "message": {"id": "msg-draft"}})
    result = GmailClient("oauth", transport=transport).create_draft(
        sender="sales@example.test",
        recipient="buyer@example.test",
        subject="Hello",
        body="Reply Sure",
    )
    assert result["id"] == "draft-1"
    assert transport.calls[0]["url"].endswith("/drafts")
    assert transport.calls[0]["payload"]["message"]["raw"] == raw


def test_gmail_send_has_environment_approval_status_and_quota_gates(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    transport = FakeTransport({"id": "msg-1", "threadId": "thread-1"})
    ledger = SendLedger(tmp_path / "ledger.json")
    client = GmailClient("oauth", transport=transport, ledger=ledger)
    lead = {"lead_id": "lead-1", "status": "approved"}
    approval = ExternalApproval(True, "CEO", "approval-1")
    monkeypatch.delenv("APBD_GMAIL_SEND_ENABLED", raising=False)
    with pytest.raises(PermissionError, match="disabled"):
        client.send_draft(draft_id="draft-1", lead=lead, approval=approval)
    monkeypatch.setenv("APBD_GMAIL_SEND_ENABLED", "1")
    result = client.send_draft(draft_id="draft-1", lead=lead, approval=approval, daily_limit=1, min_interval_seconds=0)
    assert result["id"] == "msg-1"
    with pytest.raises(PermissionError, match="Daily Gmail send limit"):
        client.send_draft(draft_id="draft-2", lead=lead, approval=approval, daily_limit=1, min_interval_seconds=0)
    assert len(transport.calls) == 1


def test_gmail_followup_can_continue_before_reply_but_not_after_reply(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APBD_GMAIL_SEND_ENABLED", "1")
    transport = FakeTransport({"id": "followup-msg"})
    client = GmailClient("oauth", transport=transport, ledger=SendLedger(tmp_path / "ledger.json"))
    approval = ExternalApproval(True, "CEO", "approval-1")
    result = client.send_draft(draft_id="draft-2", lead={"status": "sent"}, approval=approval, min_interval_seconds=0)
    assert result["id"] == "followup-msg"
    with pytest.raises(PermissionError, match="must not have replied"):
        client.send_draft(draft_id="draft-3", lead={"status": "replied"}, approval=approval, min_interval_seconds=0)


def test_send_ledger_interval_gate(tmp_path: Path) -> None:
    ledger = SendLedger(tmp_path / "ledger.json")
    ledger.record({"sent_at": "2026-09-02T12:00:00Z"})
    with pytest.raises(PermissionError, match="interval"):
        ledger.assert_allowed(
            daily_limit=40,
            min_interval_seconds=120,
            now=datetime(2026, 9, 2, 12, 0, 30, tzinfo=timezone.utc),
        )


def test_hunter_enrichment_records_usage_and_reuses_cached_result(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeHunter:
        instances = 0

        def __init__(self, api_key: str, *, paid_opt_in: bool = False) -> None:
            assert api_key == "secret"
            assert paid_opt_in is True
            self.account_calls = 0
            FakeHunter.instances += 1

        def account(self) -> dict:
            self.account_calls += 1
            if FakeHunter.instances == 1:
                search_remaining = 50 if self.account_calls == 1 else 49
                verification_remaining = 100
            else:
                search_remaining = 49
                verification_remaining = 100 if self.account_calls == 1 else 99
            return {
                "provider": "hunter",
                "plan": "Free",
                "usage": {
                    "searches": {"remaining": search_remaining},
                    "verifications": {"remaining": verification_remaining},
                },
            }

        def domain_search(self, domain: str) -> dict:
            assert domain == "example.test"
            return {
                "provider": "hunter",
                "domain": domain,
                "organization": "Example",
                "contacts": [
                    {
                        "type": "email",
                        "value": "buyer@example.test",
                        "verified": True,
                        "provider": "hunter",
                        "source": "https://example.test",
                    }
                ],
            }

        def email_verify(self, email: str) -> dict:
            assert email == "buyer@example.test"
            return {
                "provider": "hunter",
                "email": email,
                "status": "valid",
                "verified": True,
                "score": 97,
            }

    monkeypatch.setenv("HUNTER_API_KEY", "secret")
    monkeypatch.setattr("agents.apbd.solo_trade.enrichment.HunterClient", FakeHunter)
    service = SoloTradeService(CampaignStore(tmp_path / "campaigns"))
    brief = CampaignBrief(
        product_keywords=("Toyota engines",),
        target_markets=("Venezuela",),
        customer_types=("parts wholesaler",),
        enable_contact_enrichment=True,
    )
    campaign_id = service.create_campaign(brief)["campaign_id"]
    service.add_leads(
        campaign_id,
        [{"company": "Example", "country": "Venezuela", "website": "https://example.test"}],
    )
    lead_id = service.load(campaign_id)["leads"][0]["lead_id"]
    first = service.enrich(campaign_id, lead_id, provider="hunter", paid_opt_in=True)
    second = service.enrich(campaign_id, lead_id, provider="hunter", paid_opt_in=True)
    verification = service.verify_hunter_contacts(campaign_id, lead_id, paid_opt_in=True)

    assert first["cached"] is False
    assert first["result"]["new_contacts"] == 1
    assert first["result"]["usage"]["credits_used"] == 1
    assert second["cached"] is True
    assert verification["verified"] == 1
    assert verification["usage"]["credits_used"] == 1
    assert FakeHunter.instances == 2
    stored = service.load(campaign_id)["leads"][0]
    assert stored["public_email"] == "buyer@example.test"
    assert stored["public_email_source"] == "hunter_verified"
    assert stored["contacts"][0]["verification_status"] == "valid"


def test_hunter_email_verifier_uses_header_and_returns_delivery_status() -> None:
    transport = FakeTransport(
        {
            "data": {
                "status": "accept_all",
                "score": 71,
                "smtp_check": True,
                "accept_all": True,
                "block": False,
                "sources": [{"uri": "https://example.test/contact"}],
            }
        }
    )
    result = HunterClient("secret", transport=transport, paid_opt_in=True).email_verify("Sales@Example.Test")
    assert result["status"] == "accept_all"
    assert result["verified"] is False
    assert result["sources_count"] == 1
    assert transport.calls[0]["headers"]["X-API-KEY"] == "secret"
    assert "secret" not in transport.calls[0]["url"]
