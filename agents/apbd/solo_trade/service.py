"""Application service for the APBD solo-trade workbench."""

from __future__ import annotations

import csv
import hashlib
import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from agents.apbd.solo_trade.crm import build_dashboard, record_activity, transition_status
from agents.apbd.solo_trade.exports import export_campaign
from agents.apbd.solo_trade.gmail import GmailClient, SendLedger
from agents.apbd.solo_trade.models import CRMStatus, CampaignBrief, ExternalApproval, utc_now_iso
from agents.apbd.solo_trade.outreach import generate_sequence
from agents.apbd.solo_trade.planner import build_search_plan
from agents.apbd.solo_trade.scoring import score_candidate
from agents.apbd.solo_trade.storage import CampaignStore


def _lead_id(lead: dict[str, Any]) -> str:
    existing = str(lead.get("lead_id") or lead.get("id") or "").strip()
    if existing:
        return existing
    identity = "|".join(
        str(lead.get(key) or "").strip().casefold()
        for key in ("company", "display_name", "country", "website", "public_email")
    )
    return f"lead-{hashlib.sha256(identity.encode('utf-8')).hexdigest()[:12]}"


def _normalize_lead(raw: dict[str, Any]) -> dict[str, Any]:
    lead = dict(raw)
    lead["lead_id"] = _lead_id(lead)
    lead["company"] = str(lead.get("company") or lead.get("display_name") or "").strip()
    if not lead["company"]:
        raise ValueError("Each lead requires a company name")
    lead["status"] = CRMStatus.NEW.value
    lead["activities"] = []
    lead["status_history"] = []
    lead.pop("external_approval", None)
    return lead


def _usage_remaining(account: dict[str, Any], bucket: str) -> float | None:
    values = (account.get("usage") or {}).get(bucket) or {}
    raw = values.get("remaining")
    try:
        return float(raw) if raw is not None else None
    except (TypeError, ValueError):
        return None


def _merge_contacts(existing: list[dict[str, Any]], incoming: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    merged = [dict(row) for row in existing if isinstance(row, dict)]
    seen = {
        (str(row.get("type") or "").casefold(), str(row.get("value") or "").strip().casefold())
        for row in merged
        if str(row.get("value") or "").strip()
    }
    added = 0
    for row in incoming:
        if not isinstance(row, dict):
            continue
        key = (str(row.get("type") or "").casefold(), str(row.get("value") or "").strip().casefold())
        if not key[1] or key in seen:
            continue
        seen.add(key)
        merged.append(dict(row))
        added += 1
    return merged, added


class SoloTradeService:
    def __init__(self, store: CampaignStore | None = None) -> None:
        self.store = store or CampaignStore()

    def create_campaign(self, brief: CampaignBrief, *, name: str = "") -> dict[str, Any]:
        campaign_id = f"solo-{uuid.uuid4().hex[:10]}"
        now = utc_now_iso()
        campaign = {
            "schema_version": "apbd-solo-trade-v1",
            "campaign_id": campaign_id,
            "name": name.strip() or f"{brief.product_keywords[0]} / {brief.target_markets[0]}",
            "created_at": now,
            "updated_at": now,
            "brief": brief.to_dict(),
            "search_plan": build_search_plan(brief),
            "leads": [],
            "discovery_runs": [],
            "governance": {
                "owner": "APBD pre-sales",
                "commercial_source_of_truth": "APSales",
                "external_send_default": "disabled",
                "paid_provider_default": "disabled",
            },
        }
        self.store.save(campaign)
        self.store.append_audit(campaign_id, {"event": "campaign_created", "name": campaign["name"]})
        return campaign

    def load(self, campaign_id: str) -> dict[str, Any]:
        return self.store.load(campaign_id)

    def plan(self, campaign_id: str) -> dict[str, Any]:
        campaign = self.load(campaign_id)
        campaign["search_plan"] = build_search_plan(CampaignBrief.from_dict(campaign["brief"]))
        self.store.save(campaign)
        return campaign["search_plan"]

    def add_leads(self, campaign_id: str, leads: list[dict[str, Any]], *, source: str = "import") -> dict[str, Any]:
        campaign = self.load(campaign_id)
        existing = {str(row.get("lead_id")): row for row in campaign.get("leads") or []}
        added = 0
        updated = 0
        for raw in leads:
            lead = _normalize_lead(raw)
            if lead["lead_id"] in existing:
                preserved = existing[lead["lead_id"]]
                for key, value in lead.items():
                    if key in {"status", "status_history", "activities", "outreach_sequence", "external_approval"}:
                        continue
                    if value not in (None, "", [], {}):
                        preserved[key] = value
                updated += 1
            else:
                existing[lead["lead_id"]] = lead
                added += 1
        campaign["leads"] = list(existing.values())
        self.store.save(campaign)
        self.store.append_audit(campaign_id, {"event": "leads_added", "source": source, "added": added, "updated": updated})
        return {"campaign_id": campaign_id, "added": added, "updated": updated, "total": len(campaign["leads"])}

    def import_file(self, campaign_id: str, path: Path | str) -> dict[str, Any]:
        source_path = Path(path)
        if not source_path.is_file():
            raise ValueError(f"Lead import file not found: {source_path}")
        if source_path.suffix.casefold() == ".json":
            data = json.loads(source_path.read_text(encoding="utf-8"))
            leads = data.get("leads") if isinstance(data, dict) else data
        elif source_path.suffix.casefold() == ".csv":
            with source_path.open(encoding="utf-8-sig", newline="") as handle:
                leads = list(csv.DictReader(handle))
        else:
            raise ValueError("Lead imports support JSON and CSV")
        if not isinstance(leads, list):
            raise ValueError("Lead import must contain a list")
        return self.add_leads(campaign_id, [dict(row) for row in leads if isinstance(row, dict)], source=str(source_path))

    def discover(self, campaign_id: str, *, execute: bool = False) -> dict[str, Any]:
        campaign = self.load(campaign_id)
        plan = campaign.get("search_plan") or self.plan(campaign_id)
        if not execute:
            return {"ok": True, "executed": False, "plan": plan, "message": "Plan only. Pass execute=True to call public discovery sources."}
        from agents.apbd.lead_finder import discover_leads

        limits = plan["limits"]
        leads, stats = discover_leads(
            markets=plan["legacy_markets"],
            max_results_per_query=limits["results_per_query"],
            max_total=plan["max_customers"],
            max_queries=limits["max_queries"],
        )
        add_result = self.add_leads(campaign_id, leads, source="apbd_public_discovery")
        campaign = self.load(campaign_id)
        campaign.setdefault("discovery_runs", []).append({"at": utc_now_iso(), "stats": stats})
        self.store.save(campaign)
        return {"ok": bool(stats.get("ok", True)), "executed": True, "stats": stats, **add_result}

    def _lead(self, campaign: dict[str, Any], lead_id: str) -> dict[str, Any]:
        for lead in campaign.get("leads") or []:
            if str(lead.get("lead_id") or lead.get("id")) == lead_id:
                return lead
        raise ValueError(f"Lead not found: {lead_id}")

    def score(self, campaign_id: str, *, lead_id: str = "") -> dict[str, Any]:
        campaign = self.load(campaign_id)
        brief = CampaignBrief.from_dict(campaign["brief"])
        leads = [self._lead(campaign, lead_id)] if lead_id else list(campaign.get("leads") or [])
        for lead in leads:
            lead["score"] = score_candidate(lead, brief)
            if CRMStatus(str(lead.get("status") or CRMStatus.NEW.value)) is CRMStatus.NEW:
                transition_status(lead, CRMStatus.RESEARCHED, actor="solo_trade_scoring", reason="Evidence scoring completed")
        self.store.save(campaign)
        return {"campaign_id": campaign_id, "scored": len(leads), "dashboard": build_dashboard(campaign)}

    def draft(self, campaign_id: str, lead_id: str) -> dict[str, Any]:
        campaign = self.load(campaign_id)
        lead = self._lead(campaign, lead_id)
        current = CRMStatus(str(lead.get("status") or CRMStatus.NEW.value))
        if current is CRMStatus.NEW:
            raise ValueError("Score or research the lead before generating outreach")
        lead["outreach_sequence"] = generate_sequence(lead, CampaignBrief.from_dict(campaign["brief"]))
        if current is CRMStatus.RESEARCHED:
            transition_status(lead, CRMStatus.DRAFT_READY, actor="solo_trade_drafter", reason="Four draft messages generated")
        if CRMStatus(str(lead["status"])) is CRMStatus.DRAFT_READY:
            transition_status(lead, CRMStatus.APPROVAL_PENDING, actor="solo_trade_drafter", reason="Draft sequence queued for approval")
        record_activity(lead, "approval_requested", source="solo_trade_drafter", evidence_ref="local_draft_sequence")
        self.store.save(campaign)
        return {"campaign_id": campaign_id, "lead_id": lead_id, "status": lead["status"], "drafts": lead["outreach_sequence"]}

    def enrich(
        self,
        campaign_id: str,
        lead_id: str,
        *,
        provider: str,
        paid_opt_in: bool = False,
        refresh: bool = False,
    ) -> dict[str, Any]:
        campaign = self.load(campaign_id)
        lead = self._lead(campaign, lead_id)
        brief = CampaignBrief.from_dict(campaign["brief"])
        if not brief.enable_contact_enrichment:
            raise PermissionError("Campaign contact enrichment is disabled; create the campaign with enrichment enabled")
        provider_name = provider.strip().casefold()
        if provider_name == "hunter":
            from agents.apbd.solo_trade.enrichment import HunterClient

            domain = self.domain_for_lead(lead)
            if not domain:
                raise ValueError("Hunter enrichment requires a lead website domain")
            cached = (lead.get("provider_enrichment") or {}).get("hunter") or {}
            if not refresh and cached.get("status") == "completed" and cached.get("domain") == domain:
                return {
                    "campaign_id": campaign_id,
                    "lead_id": lead_id,
                    "provider": provider_name,
                    "cached": True,
                    "result": cached.get("result") or {},
                }
            client = HunterClient(os.getenv("HUNTER_API_KEY", ""), paid_opt_in=paid_opt_in)
            before = client.account()
            self.store.append_audit(
                campaign_id,
                {
                    "event": "provider_enrichment_started",
                    "lead_id": lead_id,
                    "provider": provider_name,
                    "query": domain,
                    "paid_opt_in": bool(paid_opt_in),
                },
            )
            try:
                result = client.domain_search(domain)
                after = client.account()
            except Exception as exc:
                self.store.append_audit(
                    campaign_id,
                    {
                        "event": "provider_enrichment_failed",
                        "lead_id": lead_id,
                        "provider": provider_name,
                        "query": domain,
                        "error_type": type(exc).__name__,
                    },
                )
                raise
            before_remaining = _usage_remaining(before, "searches")
            after_remaining = _usage_remaining(after, "searches")
            credits_used = (
                max(0.0, before_remaining - after_remaining)
                if before_remaining is not None and after_remaining is not None
                else None
            )
            contacts = [row for row in (result.get("contacts") or []) if isinstance(row, dict)]
            merged, added = _merge_contacts(list(lead.get("contacts") or []), contacts)
            lead["contacts"] = merged
            if str(lead.get("public_email") or "").strip() in {"", "Not published"}:
                verified_email = next(
                    (
                        str(row.get("value") or "").strip()
                        for row in contacts
                        if row.get("type") == "email" and row.get("verified") and row.get("value")
                    ),
                    "",
                )
                if verified_email:
                    lead["public_email"] = verified_email
                    lead["public_email_source"] = "hunter_verified"
            usage = {
                "plan": after.get("plan") or before.get("plan") or "",
                "searches_before": before_remaining,
                "searches_after": after_remaining,
                "credits_used": credits_used,
            }
            result = {**result, "new_contacts": added, "usage": usage}
            lead.setdefault("provider_enrichment", {})["hunter"] = {
                "status": "completed",
                "at": utc_now_iso(),
                "domain": domain,
                "paid_opt_in": True,
                "contacts_found": len(contacts),
                "new_contacts": added,
                "verified_contacts": sum(1 for row in contacts if row.get("verified")),
                "usage": usage,
                "result": result,
            }
        elif provider_name == "apollo":
            from agents.apbd.solo_trade.enrichment import ApolloClient

            result = ApolloClient(os.getenv("APOLLO_API_KEY", ""), paid_opt_in=paid_opt_in).organization_search(
                [lead.get("company") or "", lead.get("business_type") or ""], per_page=5
            )
            lead.setdefault("provider_enrichment", {})["apollo_organizations"] = result.get("organizations") or []
        else:
            raise ValueError("provider must be hunter or apollo")
        if provider_name != "hunter":
            lead.setdefault("provider_enrichment", {})[provider_name] = {
                "status": "completed",
                "at": utc_now_iso(),
                "paid_opt_in": True,
            }
        self.store.save(campaign)
        self.store.append_audit(
            campaign_id,
            {
                "event": "provider_enrichment_completed",
                "lead_id": lead_id,
                "provider": provider_name,
                "new_contacts": int(result.get("new_contacts") or 0),
                "credits_used": (result.get("usage") or {}).get("credits_used"),
            },
        )
        return {"campaign_id": campaign_id, "lead_id": lead_id, "provider": provider_name, "cached": False, "result": result}

    def verify_hunter_contacts(
        self,
        campaign_id: str,
        lead_id: str,
        *,
        paid_opt_in: bool = False,
        refresh: bool = False,
        max_contacts: int = 10,
    ) -> dict[str, Any]:
        """Verify Hunter-returned emails and record the real verification quota delta."""
        campaign = self.load(campaign_id)
        lead = self._lead(campaign, lead_id)
        brief = CampaignBrief.from_dict(campaign["brief"])
        if not brief.enable_contact_enrichment:
            raise PermissionError("Campaign contact enrichment is disabled; create the campaign with enrichment enabled")
        hunter_state = (lead.get("provider_enrichment") or {}).get("hunter") or {}
        hunter_result = hunter_state.get("result") or {}
        found_contacts = [
            row
            for row in (hunter_result.get("contacts") or [])
            if isinstance(row, dict) and row.get("type") == "email" and row.get("value")
        ]
        if not found_contacts:
            return {
                "campaign_id": campaign_id,
                "lead_id": lead_id,
                "provider": "hunter",
                "verified": 0,
                "results": [],
                "usage": {"credits_used": 0.0},
            }
        completed = hunter_state.get("verification") or {}
        completed_result = completed.get("result") or {}
        previous_results = [row for row in (completed_result.get("results") or []) if isinstance(row, dict)]
        by_email = {
            str(row.get("email") or "").strip().casefold(): dict(row)
            for row in previous_results
            if str(row.get("email") or "").strip()
        }
        candidate_emails = [str(row.get("value") or "").strip().casefold() for row in found_contacts]
        pending_contacts = [
            row
            for row in found_contacts
            if refresh
            or str(row.get("value") or "").strip().casefold() not in by_email
            or by_email[str(row.get("value") or "").strip().casefold()].get("status") == "error"
        ]
        if not pending_contacts:
            return {
                "campaign_id": campaign_id,
                "lead_id": lead_id,
                "provider": "hunter",
                "cached": True,
                **completed_result,
            }

        from agents.apbd.solo_trade.enrichment import HunterClient

        client = HunterClient(os.getenv("HUNTER_API_KEY", ""), paid_opt_in=paid_opt_in)
        before = client.account()
        self.store.append_audit(
            campaign_id,
            {
                "event": "provider_verification_started",
                "lead_id": lead_id,
                "provider": "hunter",
                "contacts": min(len(pending_contacts), max(1, min(20, int(max_contacts)))),
                "paid_opt_in": bool(paid_opt_in),
            },
        )
        selected = pending_contacts[: max(1, min(20, int(max_contacts)))]
        for contact in selected:
            email = str(contact.get("value") or "").strip().casefold()
            try:
                verification = client.email_verify(email)
            except Exception as exc:
                verification = {
                    "provider": "hunter",
                    "email": email,
                    "status": "error",
                    "verified": False,
                    "error_type": type(exc).__name__,
                }
            by_email[email] = verification
            for row in list(lead.get("contacts") or []) + found_contacts:
                if str(row.get("value") or "").strip().casefold() != email:
                    continue
                row["verification_status"] = verification.get("status")
                row["verified"] = bool(verification.get("verified"))
                row["verification_score"] = verification.get("score")
                row["verification_provider"] = "hunter"
            partial_results = [by_email[key] for key in candidate_emails if key in by_email]
            hunter_state["verification"] = {
                "status": "partial",
                "at": utc_now_iso(),
                "result": {
                    "verified": sum(1 for row in partial_results if row.get("status") == "valid"),
                    "invalid": sum(1 for row in partial_results if row.get("status") == "invalid"),
                    "accept_all": sum(1 for row in partial_results if row.get("status") == "accept_all"),
                    "unknown": sum(1 for row in partial_results if row.get("status") in {"unknown", "error", ""}),
                    "results": partial_results,
                    "usage": completed_result.get("usage") or {},
                },
            }
            lead.setdefault("provider_enrichment", {})["hunter"] = hunter_state
            self.store.save(campaign)
        after = client.account()
        before_remaining = _usage_remaining(before, "verifications")
        after_remaining = _usage_remaining(after, "verifications")
        credits_used = (
            max(0.0, before_remaining - after_remaining)
            if before_remaining is not None and after_remaining is not None
            else None
        )
        usage = {
            "plan": after.get("plan") or before.get("plan") or "",
            "verifications_before": before_remaining,
            "verifications_after": after_remaining,
            "credits_used": credits_used,
        }
        results = [by_email[key] for key in candidate_emails if key in by_email]
        previous_total = (completed_result.get("usage") or {}).get("total_credits_used")
        try:
            total_credits_used = float(previous_total or 0) + float(credits_used or 0)
        except (TypeError, ValueError):
            total_credits_used = credits_used
        usage["total_credits_used"] = total_credits_used
        summary = {
            "verified": sum(1 for row in results if row.get("status") == "valid"),
            "invalid": sum(1 for row in results if row.get("status") == "invalid"),
            "accept_all": sum(1 for row in results if row.get("status") == "accept_all"),
            "unknown": sum(1 for row in results if row.get("status") in {"unknown", "error", ""}),
            "results": results,
            "usage": usage,
        }
        fully_checked = all(key in by_email and by_email[key].get("status") != "error" for key in candidate_emails)
        hunter_state["verification"] = {
            "status": "completed" if fully_checked else "partial",
            "at": utc_now_iso(),
            "result": summary,
        }
        lead.setdefault("provider_enrichment", {})["hunter"] = hunter_state
        self.store.save(campaign)
        self.store.append_audit(
            campaign_id,
            {
                "event": "provider_verification_completed",
                "lead_id": lead_id,
                "provider": "hunter",
                "checked": len(selected),
                "total_checked": len(results),
                "status": hunter_state["verification"]["status"],
                "valid": summary["verified"],
                "invalid": summary["invalid"],
                "accept_all": summary["accept_all"],
                "unknown": summary["unknown"],
                "credits_used": credits_used,
            },
        )
        return {
            "campaign_id": campaign_id,
            "lead_id": lead_id,
            "provider": "hunter",
            "cached": False,
            **summary,
        }

    def sync_apbd(self, campaign_id: str, *, lead_id: str = "") -> dict[str, Any]:
        """Link campaign leads to the canonical APBD company repository."""
        from agents.apbd.solo_trade.apbd_bridge import sync_campaign_to_apbd

        campaign = self.load(campaign_id)
        result = sync_campaign_to_apbd(campaign, lead_id=lead_id)
        self.store.save(campaign)
        self.store.append_audit(
            campaign_id,
            {
                "event": "apbd_repository_synced",
                "lead_id": lead_id,
                "linked": result.get("linked", 0),
                "created": result.get("created", 0),
                "updated": result.get("updated", 0),
            },
        )
        return {"campaign_id": campaign_id, **result}

    def approve(self, campaign_id: str, lead_id: str, approval: ExternalApproval) -> dict[str, Any]:
        approval.validate()
        campaign = self.load(campaign_id)
        lead = self._lead(campaign, lead_id)
        if CRMStatus(str(lead.get("status"))) is not CRMStatus.APPROVAL_PENDING:
            raise ValueError("Lead must be approval_pending before approval")
        lead["external_approval"] = approval.to_dict()
        transition_status(lead, CRMStatus.APPROVED, actor=approval.approved_by, reason=f"External approval {approval.approval_id}")
        self.store.save(campaign)
        self.store.append_audit(campaign_id, {"event": "external_send_approved", "lead_id": lead_id, "approval_id": approval.approval_id, "approved_by": approval.approved_by})
        return {"campaign_id": campaign_id, "lead_id": lead_id, "status": lead["status"], "approval": approval.to_dict()}

    def create_gmail_draft(self, campaign_id: str, lead_id: str, *, step: int = 1) -> dict[str, Any]:
        campaign = self.load(campaign_id)
        lead = self._lead(campaign, lead_id)
        sequence = list(lead.get("outreach_sequence") or [])
        if not 1 <= step <= len(sequence):
            raise ValueError("Generate the draft sequence first and choose a valid step")
        recipient = str(lead.get("public_email") or lead.get("email") or "").strip()
        sender = os.getenv("APBD_GMAIL_SENDER", "").strip()
        if not recipient:
            raise ValueError("Lead has no email address")
        if not sender:
            raise PermissionError("APBD_GMAIL_SENDER is required")
        draft = sequence[step - 1]
        gmail = GmailClient(os.getenv("GOOGLE_OAUTH_ACCESS_TOKEN", ""))
        result = gmail.create_draft(sender=sender, recipient=recipient, subject=draft["subject"], body=draft["body"])
        draft["gmail_draft_id"] = str(result.get("id") or "")
        draft["gmail_draft_created_at"] = utc_now_iso()
        record_activity(lead, "draft_created", source="gmail_api", evidence_ref=draft["gmail_draft_id"])
        self.store.save(campaign)
        return {"campaign_id": campaign_id, "lead_id": lead_id, "step": step, "gmail_draft_id": draft["gmail_draft_id"]}

    def send_gmail_draft(
        self,
        campaign_id: str,
        lead_id: str,
        *,
        step: int,
        approval: ExternalApproval,
    ) -> dict[str, Any]:
        campaign = self.load(campaign_id)
        lead = self._lead(campaign, lead_id)
        stored = lead.get("external_approval") or {}
        approval.validate()
        if stored.get("approval_id") != approval.approval_id or stored.get("approved_by") != approval.approved_by:
            raise PermissionError("Send approval does not match the approval stored on the lead")
        sequence = list(lead.get("outreach_sequence") or [])
        if not 1 <= step <= len(sequence):
            raise ValueError("Choose a valid draft step")
        if sequence[step - 1].get("status") == "sent":
            raise PermissionError("This sequence step has already been sent")
        if step > 1:
            previous = sequence[: step - 1]
            if any(item.get("status") != "sent" for item in previous):
                raise PermissionError("Earlier sequence steps must be sent before this follow-up")
            first_sent_raw = str(previous[0].get("sent_at") or "").replace("Z", "+00:00")
            if not first_sent_raw:
                raise PermissionError("The first send timestamp is required for follow-up timing")
            first_sent = datetime.fromisoformat(first_sent_raw)
            due_at = first_sent + timedelta(days=int(sequence[step - 1].get("send_after_days") or 0))
            if datetime.now(timezone.utc) < due_at:
                raise PermissionError(f"Follow-up is not due until {due_at.isoformat()}")
        draft_id = str(sequence[step - 1].get("gmail_draft_id") or "")
        if not draft_id:
            raise ValueError("Create the Gmail draft before sending")
        ledger = SendLedger(self.store.campaign_dir(campaign_id) / "gmail-send-ledger.json")
        gmail = GmailClient(os.getenv("GOOGLE_OAUTH_ACCESS_TOKEN", ""), ledger=ledger)
        result = gmail.send_draft(
            draft_id=draft_id,
            lead=lead,
            approval=approval,
            daily_limit=int(os.getenv("APBD_GMAIL_DAILY_LIMIT", "40")),
            min_interval_seconds=int(os.getenv("APBD_GMAIL_MIN_INTERVAL_SECONDS", "120")),
        )
        if CRMStatus(str(lead.get("status"))) is CRMStatus.APPROVED:
            transition_status(lead, CRMStatus.SENT, actor="gmail_api", reason=f"Provider message {result.get('id') or 'recorded'}")
        record_activity(lead, "sent", source="gmail_api", evidence_ref=str(result.get("id") or draft_id))
        sequence[step - 1]["status"] = "sent"
        sequence[step - 1]["sent_at"] = utc_now_iso()
        sequence[step - 1]["gmail_message_id"] = str(result.get("id") or "")
        self.store.save(campaign)
        self.store.append_audit(campaign_id, {"event": "gmail_draft_sent", "lead_id": lead_id, "step": step, "approval_id": approval.approval_id})
        return {"campaign_id": campaign_id, "lead_id": lead_id, "step": step, "status": lead["status"], "gmail_message_id": result.get("id") or ""}

    def record_event(self, campaign_id: str, lead_id: str, event: str, *, source: str, evidence_ref: str, note: str = "") -> dict[str, Any]:
        campaign = self.load(campaign_id)
        lead = self._lead(campaign, lead_id)
        record_activity(lead, event, source=source, evidence_ref=evidence_ref, note=note)
        self.store.save(campaign)
        return {"campaign_id": campaign_id, "lead_id": lead_id, "status": lead["status"], "event": event}

    def dashboard(self, campaign_id: str) -> dict[str, Any]:
        return build_dashboard(self.load(campaign_id))

    def export(self, campaign_id: str, *, fmt: str = "all") -> dict[str, str]:
        campaign = self.load(campaign_id)
        outputs = export_campaign(campaign, self.store.export_dir(campaign_id), fmt)
        self.store.append_audit(campaign_id, {"event": "campaign_exported", "formats": sorted(outputs)})
        return outputs

    @staticmethod
    def provider_status() -> dict[str, Any]:
        return {
            "hunter": {"configured": bool(os.getenv("HUNTER_API_KEY", "").strip()), "requires_paid_opt_in": True},
            "apollo": {"configured": bool(os.getenv("APOLLO_API_KEY", "").strip()), "requires_paid_opt_in": True},
            "gmail": {
                "oauth_token_configured": bool(os.getenv("GOOGLE_OAUTH_ACCESS_TOKEN", "").strip()),
                "sender_configured": bool(os.getenv("APBD_GMAIL_SENDER", "").strip()),
                "external_send_enabled": os.getenv("APBD_GMAIL_SEND_ENABLED", "").strip() == "1",
                "requires_lead_approval": True,
            },
        }

    @staticmethod
    def domain_for_lead(lead: dict[str, Any]) -> str:
        return (urlparse(str(lead.get("website") or "")).hostname or "").removeprefix("www.")
