"""Gmail draft creation and separately gated sending."""

from __future__ import annotations

import base64
import json
import os
from contextlib import contextmanager
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path
from typing import Any

from agents.apbd.solo_trade.enrichment import HttpJsonTransport, JsonTransport
from agents.apbd.solo_trade.models import CRMStatus, ExternalApproval, utc_now_iso


def build_raw_message(*, sender: str, recipient: str, subject: str, body: str) -> str:
    message = EmailMessage()
    message["From"] = sender.strip()
    message["To"] = recipient.strip()
    message["Subject"] = subject.strip()
    message.set_content(body)
    return base64.urlsafe_b64encode(message.as_bytes()).decode("ascii").rstrip("=")


class SendLedger:
    def __init__(self, path: Path | str) -> None:
        self.path = Path(path)

    def _load(self) -> list[dict[str, Any]]:
        if not self.path.is_file():
            return []
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return []
        return list(data) if isinstance(data, list) else []

    @contextmanager
    def locked(self):
        import fcntl

        lock_path = self.path.with_suffix(self.path.suffix + ".lock")
        lock_path.parent.mkdir(parents=True, exist_ok=True)
        with lock_path.open("a+", encoding="utf-8") as handle:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)

    def assert_allowed(self, *, daily_limit: int, min_interval_seconds: int, now: datetime | None = None) -> None:
        moment = now or datetime.now(timezone.utc)
        rows = self._load()
        today = moment.date().isoformat()
        today_rows = [row for row in rows if str(row.get("sent_at") or "").startswith(today)]
        if len(today_rows) >= daily_limit:
            raise PermissionError(f"Daily Gmail send limit reached: {daily_limit}")
        if rows:
            last_raw = str(rows[-1].get("sent_at") or "").replace("Z", "+00:00")
            if last_raw:
                last = datetime.fromisoformat(last_raw)
                elapsed = (moment - last).total_seconds()
                if elapsed < min_interval_seconds:
                    raise PermissionError(f"Gmail safety interval has not elapsed: {int(elapsed)}/{min_interval_seconds}s")

    def record(self, row: dict[str, Any]) -> None:
        rows = self._load()
        rows.append(row)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(rows[-1000:], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


class GmailClient:
    base_url = "https://gmail.googleapis.com/gmail/v1/users/me"

    def __init__(self, access_token: str, *, transport: JsonTransport | None = None, ledger: SendLedger | None = None) -> None:
        self.access_token = access_token.strip()
        self.transport = transport or HttpJsonTransport()
        self.ledger = ledger

    def _headers(self) -> dict[str, str]:
        if not self.access_token:
            raise PermissionError("A Google OAuth access token is required")
        return {"Authorization": f"Bearer {self.access_token}", "Content-Type": "application/json"}

    def create_draft(self, *, sender: str, recipient: str, subject: str, body: str) -> dict[str, Any]:
        if not all(str(value).strip() for value in (sender, recipient, subject, body)):
            raise ValueError("sender, recipient, subject, and body are required")
        return self.transport.request(
            "POST",
            f"{self.base_url}/drafts",
            headers=self._headers(),
            payload={"message": {"raw": build_raw_message(sender=sender, recipient=recipient, subject=subject, body=body)}},
        )

    def send_draft(
        self,
        *,
        draft_id: str,
        lead: dict[str, Any],
        approval: ExternalApproval,
        daily_limit: int = 40,
        min_interval_seconds: int = 120,
    ) -> dict[str, Any]:
        if os.getenv("APBD_GMAIL_SEND_ENABLED", "").strip() != "1":
            raise PermissionError("External Gmail sending is disabled; set APBD_GMAIL_SEND_ENABLED=1 after approval")
        approval.validate()
        allowed_statuses = {CRMStatus.APPROVED, CRMStatus.SENT, CRMStatus.OPENED}
        if CRMStatus(str(lead.get("status") or CRMStatus.NEW.value)) not in allowed_statuses:
            raise PermissionError("Lead must be approved, sent, or opened and must not have replied before sending")
        if not draft_id.strip():
            raise ValueError("draft_id is required")
        if self.ledger is None:
            raise ValueError("A send ledger is required for external sending")
        with self.ledger.locked():
            self.ledger.assert_allowed(daily_limit=max(1, int(daily_limit)), min_interval_seconds=max(0, int(min_interval_seconds)))
            result = self.transport.request(
                "POST",
                f"{self.base_url}/drafts/send",
                headers=self._headers(),
                payload={"id": draft_id.strip()},
            )
            self.ledger.record(
                {
                    "sent_at": utc_now_iso(),
                    "draft_id": draft_id.strip(),
                    "message_id": result.get("id") or "",
                    "lead_id": lead.get("lead_id") or lead.get("id") or "",
                    "approval_id": approval.approval_id,
                    "approved_by": approval.approved_by,
                }
            )
        return result
