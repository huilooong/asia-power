"""Atomic file storage for APBD pre-sales campaign workspaces."""

from __future__ import annotations

import json
import re
import tempfile
from pathlib import Path
from typing import Any

from agents.apbd.solo_trade.models import utc_now_iso

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CAMPAIGN_DIR = ROOT / "runtime" / "apbd" / "solo_trade" / "campaigns"


def _safe_id(value: str) -> str:
    safe = re.sub(r"[^a-zA-Z0-9_-]", "", str(value or ""))
    if not safe:
        raise ValueError("A valid campaign ID is required")
    return safe


class CampaignStore:
    def __init__(self, root: Path | str | None = None) -> None:
        self.root = Path(root) if root is not None else DEFAULT_CAMPAIGN_DIR

    def campaign_dir(self, campaign_id: str) -> Path:
        return self.root / _safe_id(campaign_id)

    def campaign_path(self, campaign_id: str) -> Path:
        return self.campaign_dir(campaign_id) / "campaign.json"

    def save(self, campaign: dict[str, Any]) -> dict[str, Any]:
        campaign_id = _safe_id(str(campaign.get("campaign_id") or ""))
        campaign["campaign_id"] = campaign_id
        campaign["updated_at"] = utc_now_iso()
        path = self.campaign_path(campaign_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=str(path.parent))
        try:
            with open(fd, "w", encoding="utf-8") as handle:
                json.dump(campaign, handle, ensure_ascii=False, indent=2)
                handle.write("\n")
            Path(tmp_name).replace(path)
        except Exception:
            Path(tmp_name).unlink(missing_ok=True)
            raise
        return campaign

    def load(self, campaign_id: str) -> dict[str, Any]:
        path = self.campaign_path(campaign_id)
        if not path.is_file():
            raise ValueError(f"Campaign not found: {campaign_id}")
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise ValueError(f"Invalid campaign file: {path}")
        return data

    def list(self) -> list[dict[str, Any]]:
        if not self.root.is_dir():
            return []
        rows: list[dict[str, Any]] = []
        for path in sorted(self.root.glob("*/campaign.json"), reverse=True):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            if isinstance(data, dict):
                rows.append(data)
        return rows

    def export_dir(self, campaign_id: str) -> Path:
        path = self.campaign_dir(campaign_id) / "exports"
        path.mkdir(parents=True, exist_ok=True)
        return path

    def audit_path(self, campaign_id: str) -> Path:
        path = self.campaign_dir(campaign_id) / "audit.jsonl"
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    def append_audit(self, campaign_id: str, event: dict[str, Any]) -> None:
        row = {"at": utc_now_iso(), **event}
        with self.audit_path(campaign_id).open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
