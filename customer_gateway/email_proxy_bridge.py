"""Mark email thread processed in data/email-threads.json."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from customer_gateway.email_inbound import EMAIL_THREADS_FILE


from customer_gateway.email_inbound import EMAIL_THREADS_FILE


def mark_thread_processed(thread_id: str) -> bool:
    if not EMAIL_THREADS_FILE.is_file():
        return False
    data = json.loads(EMAIL_THREADS_FILE.read_text(encoding="utf-8"))
    threads = data.get("threads") or []
    updated = False
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    for t in threads:
        if t.get("threadId") == thread_id:
            t["processedByApsales"] = True
            t["processedByAgent"] = True
            t["updatedAt"] = now
            updated = True
            break
    if updated:
        EMAIL_THREADS_FILE.write_text(
            json.dumps(data, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
    return updated
