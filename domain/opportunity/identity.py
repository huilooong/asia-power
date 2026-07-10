"""Customer identity hashing (APSALES-101)."""

from __future__ import annotations

import hashlib
import re
import uuid
from typing import Any


def _norm_email(value: str | None) -> str:
    return (value or "").strip().lower()


def _norm_phone(value: str | None) -> str:
    digits = re.sub(r"\D", "", value or "")
    if digits.startswith("00"):
        digits = digits[2:]
    return digits


def compute_customer_hash(payload: dict[str, Any]) -> str:
    """
    T1 explicit → T2 email/phone → T3 channel:handle → T4 channel:name|inquiry_id.
    Returns 16-char hex SHA256 prefix.
    """
    if payload.get("customer_hash"):
        return str(payload["customer_hash"]).strip()[:32]

    email = _norm_email(payload.get("email"))
    phone = _norm_phone(payload.get("phone") or payload.get("whatsapp"))
    channel = (payload.get("channel") or payload.get("source") or "unknown").strip().lower()

    if email:
        identity_key = email
    elif phone:
        identity_key = phone
    elif channel:
        handle = payload.get("handle") or payload.get("whatsapp") or payload.get("phone")
        if handle:
            identity_key = f"{channel}:{_norm_phone(str(handle))}"
        else:
            name = (payload.get("customer_name") or payload.get("customer") or "unknown").strip().lower()
            inquiry_id = (
                payload.get("inquiry_id")
                or payload.get("correlation_id")
                or payload.get("event_id")
                or uuid.uuid4().hex[:8]
            )
            identity_key = f"{channel}:{name}|inquiry_id:{inquiry_id}"
    else:
        name = (payload.get("customer_name") or "unknown").strip().lower()
        inquiry_id = payload.get("inquiry_id") or uuid.uuid4().hex[:8]
        identity_key = f"unknown:{name}|inquiry_id:{inquiry_id}"

    return hashlib.sha256(identity_key.encode("utf-8")).hexdigest()[:16]
