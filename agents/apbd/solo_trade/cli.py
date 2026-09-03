"""CLI adapter for `/apbd solo ...` workbench commands."""

from __future__ import annotations

import json
import shlex
from typing import Any

from agents.apbd.solo_trade.models import CampaignBrief, ExternalApproval
from agents.apbd.solo_trade.service import SoloTradeService


def _flags(parts: list[str]) -> dict[str, str]:
    result: dict[str, str] = {}
    index = 0
    while index < len(parts):
        token = parts[index]
        if token.startswith("--") and "=" in token:
            key, value = token[2:].split("=", 1)
            result[key.replace("-", "_")] = value
            index += 1
        elif token.startswith("--") and index + 1 < len(parts) and not parts[index + 1].startswith("--"):
            result[token[2:].replace("-", "_")] = parts[index + 1]
            index += 2
        elif token.startswith("--"):
            result[token[2:].replace("-", "_")] = "1"
            index += 1
        else:
            index += 1
    return result


def _list(value: str) -> tuple[str, ...]:
    return tuple(item.strip() for item in value.split(",") if item.strip())


def _format(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2)


def run_solo_cli(message: str, *, service: SoloTradeService | None = None) -> str:
    try:
        parts = shlex.split((message or "").strip())
    except ValueError as exc:
        return f"APBD solo command error: {exc}"
    if len(parts) < 3:
        return help_text()
    action = parts[2].casefold()
    flags = _flags(parts[3:])
    app = service or SoloTradeService()
    try:
        if action == "help":
            return help_text()
        if action == "create":
            brief = CampaignBrief(
                product_keywords=_list(flags.get("product", "")),
                target_markets=_list(flags.get("market", "")),
                customer_types=_list(flags.get("type", "")),
                search_depth=int(flags.get("depth") or 2),
                max_customers=int(flags.get("max") or 20),
                output_language=flags.get("language") or "en",
                enable_contact_enrichment=flags.get("enrich") == "1",
            )
            return _format(app.create_campaign(brief, name=flags.get("name") or ""))
        campaign_id = flags.get("campaign") or ""
        if action == "list":
            return _format({"campaigns": app.store.list()})
        if action == "providers":
            return _format(app.provider_status())
        if not campaign_id:
            return "Missing --campaign <campaign_id>"
        if action == "plan":
            return _format(app.plan(campaign_id))
        if action == "discover":
            return _format(app.discover(campaign_id, execute=flags.get("execute") == "1"))
        if action == "import":
            return _format(app.import_file(campaign_id, flags.get("file") or ""))
        if action == "score":
            return _format(app.score(campaign_id, lead_id=flags.get("lead") or ""))
        if action == "enrich":
            return _format(
                app.enrich(
                    campaign_id,
                    flags.get("lead") or "",
                    provider=flags.get("provider") or "",
                    paid_opt_in=flags.get("paid_opt_in") == "1",
                    refresh=flags.get("refresh") == "1",
                )
            )
        if action == "verify-hunter":
            return _format(
                app.verify_hunter_contacts(
                    campaign_id,
                    flags.get("lead") or "",
                    paid_opt_in=flags.get("paid_opt_in") == "1",
                    refresh=flags.get("refresh") == "1",
                    max_contacts=int(flags.get("max") or 10),
                )
            )
        if action == "sync-apbd":
            return _format(app.sync_apbd(campaign_id, lead_id=flags.get("lead") or ""))
        if action == "drafts":
            return _format(app.draft(campaign_id, flags.get("lead") or ""))
        if action == "approve":
            approval = ExternalApproval(
                approved=True,
                approved_by=flags.get("approved_by") or flags.get("reviewer") or "",
                approval_id=flags.get("approval_id") or "",
            )
            return _format(app.approve(campaign_id, flags.get("lead") or "", approval))
        if action == "gmail-draft":
            return _format(app.create_gmail_draft(campaign_id, flags.get("lead") or "", step=int(flags.get("step") or 1)))
        if action == "gmail-send":
            approval = ExternalApproval(
                approved=True,
                approved_by=flags.get("approved_by") or "",
                approval_id=flags.get("approval_id") or "",
            )
            return _format(app.send_gmail_draft(campaign_id, flags.get("lead") or "", step=int(flags.get("step") or 1), approval=approval))
        if action == "event":
            return _format(app.record_event(campaign_id, flags.get("lead") or "", flags.get("event") or "", source=flags.get("source") or "", evidence_ref=flags.get("evidence") or "", note=flags.get("note") or ""))
        if action == "dashboard":
            return _format(app.dashboard(campaign_id))
        if action == "export":
            return _format(app.export(campaign_id, fmt=flags.get("format") or "all"))
    except Exception as exc:
        return f"APBD solo error: {exc}"
    return help_text()


def help_text() -> str:
    return (
        "APBD solo commands:\n"
        "  /apbd solo create --product \"diesel engines\" --market \"Accra, Ghana\" --type importer,wholesaler --depth 2 --max 20\n"
        "  /apbd solo list\n"
        "  /apbd solo plan --campaign <id>\n"
        "  /apbd solo discover --campaign <id> [--execute]\n"
        "  /apbd solo import --campaign <id> --file <leads.json|leads.csv>\n"
        "  /apbd solo score --campaign <id> [--lead <id>]\n"
        "  /apbd solo enrich --campaign <id> --lead <id> --provider hunter|apollo --paid-opt-in [--refresh]\n"
        "  /apbd solo verify-hunter --campaign <id> --lead <id> --paid-opt-in [--max 10] [--refresh]\n"
        "  /apbd solo sync-apbd --campaign <id> [--lead <id>]\n"
        "  /apbd solo drafts --campaign <id> --lead <id>\n"
        "  /apbd solo approve --campaign <id> --lead <id> --approval-id <id> --approved-by <name>\n"
        "  /apbd solo gmail-draft --campaign <id> --lead <id> [--step 1]\n"
        "  /apbd solo gmail-send --campaign <id> --lead <id> --step 1 --approval-id <id> --approved-by <name>\n"
        "  /apbd solo event --campaign <id> --lead <id> --event opened|replied|qualified --source <provider> --evidence <id>\n"
        "  /apbd solo dashboard --campaign <id>\n"
        "  /apbd solo export --campaign <id> --format json|csv|xlsx|pdf|all\n"
        "  /apbd solo providers\n"
        "Discovery is plan-only unless --execute is provided. Gmail sending has environment, approval, status, quota, and interval gates."
    )
