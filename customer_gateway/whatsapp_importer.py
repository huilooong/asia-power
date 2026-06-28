"""Import WhatsApp exported .txt chat files (read-only copy to gateway storage)."""

from __future__ import annotations

import hashlib
import shutil
from datetime import datetime, timezone
from pathlib import Path

from customer_gateway.conversation_parser import parse_whatsapp_txt, save_parsed_conversation
from customer_gateway.gateway_readonly import RAW_DIR, ROOT, assert_readonly, ensure_gateway_dirs


def import_whatsapp_txt(source_path: str | Path) -> str:
    """Copy raw export and parse into structured JSON. Never modifies source file."""
    assert_readonly("import_whatsapp_txt")
    ensure_gateway_dirs()

    src = Path(source_path).expanduser()
    if not src.is_file():
        return f"Error: file not found: {src}"

    if src.suffix.lower() != ".txt":
        return f"Error: expected .txt WhatsApp export, got: {src.suffix}"

    digest = hashlib.sha256(src.read_bytes()).hexdigest()[:12]
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    dest_name = f"{ts}_{src.stem}_{digest}.txt"
    dest = RAW_DIR / dest_name

    shutil.copy2(src, dest)

    conversation = parse_whatsapp_txt(dest, original_name=src.name)
    out_path = save_parsed_conversation(conversation)

    contact = conversation.get("contact", "unknown")
    msg_count = len(conversation.get("messages", []))
    return (
        f"WhatsApp import OK (read-only)\n"
        f"Source: {src}\n"
        f"Raw copy: {dest.relative_to(ROOT)}\n"
        f"Parsed: {out_path.name}\n"
        f"Contact: {contact}\n"
        f"Messages: {msg_count}\n"
        f"Next: /whatsapp analyze"
    )
