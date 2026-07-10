"""Decision stub placeholder until APSALES-102."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent.parent
DECISIONS_FILE = ROOT / "data" / "apsales" / "decisions.jsonl"


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def reconfigure_decisions_file(path: Path) -> None:
    global DECISIONS_FILE
    DECISIONS_FILE = path
    DECISIONS_FILE.parent.mkdir(parents=True, exist_ok=True)


def generate_decision_id() -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    return f"DEC-{stamp}-{uuid.uuid4().hex[:6]}"


def build_decision_stub(opportunity_id: str) -> dict[str, Any]:
    return {
        "decision_id": generate_decision_id(),
        "opportunity_id": opportunity_id,
        "timestamp": _now_iso(),
        "status": "pending",
        "decision": "pending",
        "confidence": 0,
        "reason": "waiting APSALES-102",
    }


def persist_decision_stub(stub: dict[str, Any]) -> None:
    DECISIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with DECISIONS_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(stub, ensure_ascii=False) + "\n")
