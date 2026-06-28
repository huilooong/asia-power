"""Persistent Memory Engine — structured long-term memory for AsiaPower AI OS."""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

MEMORY_DIR = Path(__file__).resolve().parent.parent / "memory"
INDEX_FILE = MEMORY_DIR / "index.json"

SHARED_MEMORY_FILE = MEMORY_DIR / "shared_memory.md"
DECISIONS_FILE = MEMORY_DIR / "decisions.md"
CUSTOMERS_FILE = MEMORY_DIR / "customers.md"

MEMORY_FILES = (SHARED_MEMORY_FILE, DECISIONS_FILE, CUSTOMERS_FILE)

SUBDIR_NAMES = (
    "company",
    "decisions",
    "projects",
    "customers",
    "suppliers",
    "daily_logs",
    "agent_notes",
)

IMPORTANT_DECISION_KEYWORDS = (
    "deploy", "deployment", "git push", "production", "server",
    "payment", "api key", "delete", "new agent", "contract",
    "部署", "上线", "生产", "付款", "删除", "新 agent", "合同",
)

CEO_APPROVAL_VALUES = frozenset({"approved", "pending", "not_required"})


def reconfigure_paths(memory_dir: Path) -> None:
    """Point all memory paths at a directory (for tests)."""
    global MEMORY_DIR, INDEX_FILE, SHARED_MEMORY_FILE, DECISIONS_FILE, CUSTOMERS_FILE, MEMORY_FILES
    MEMORY_DIR = memory_dir
    INDEX_FILE = MEMORY_DIR / "index.json"
    SHARED_MEMORY_FILE = MEMORY_DIR / "shared_memory.md"
    DECISIONS_FILE = MEMORY_DIR / "decisions.md"
    CUSTOMERS_FILE = MEMORY_DIR / "customers.md"
    MEMORY_FILES = (SHARED_MEMORY_FILE, DECISIONS_FILE, CUSTOMERS_FILE)


def _subdir(name: str) -> Path:
    return MEMORY_DIR / name


def _timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _slug(text: str, max_len: int = 48) -> str:
    slug = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "-", (text or "").lower()).strip("-")
    if not slug:
        slug = "note"
    return slug[:max_len].strip("-") or "note"


def _ensure_memory_dir() -> None:
    MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    for name in SUBDIR_NAMES:
        (_subdir(name)).mkdir(parents=True, exist_ok=True)
    if not INDEX_FILE.exists():
        INDEX_FILE.write_text(
            json.dumps({"version": "1.0", "updated_at": _timestamp(), "entries": []}, indent=2),
            encoding="utf-8",
        )


def _load_index() -> dict:
    _ensure_memory_dir()
    try:
        data = json.loads(INDEX_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        data = {"version": "1.0", "updated_at": _timestamp(), "entries": []}
    data.setdefault("entries", [])
    return data


def _save_index(data: dict) -> None:
    data["updated_at"] = _timestamp()
    INDEX_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _index_add(
    entry_type: str,
    rel_path: str,
    title: str,
    *,
    tags: list[str] | None = None,
    keywords: list[str] | None = None,
    ceo_approval: str = "not_required",
    source: str = "unknown",
) -> str:
    data = _load_index()
    entry_id = f"mem-{uuid.uuid4().hex[:8]}"
    data["entries"].append({
        "id": entry_id,
        "type": entry_type,
        "path": rel_path,
        "title": title,
        "tags": tags or [],
        "keywords": keywords or [],
        "ceo_approval": ceo_approval,
        "source": source,
        "created_at": _timestamp(),
    })
    _save_index(data)
    return entry_id


def _append_markdown(path: Path, block: str) -> None:
    _ensure_memory_dir()
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text(f"# {path.stem.replace('-', ' ').title()}\n\n", encoding="utf-8")
    with path.open("a", encoding="utf-8") as f:
        f.write(block)
        if not block.endswith("\n"):
            f.write("\n")


def _write_markdown(path: Path, content: str) -> None:
    _ensure_memory_dir()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _is_important_decision(text: str) -> bool:
    lower = (text or "").lower()
    return any(kw in lower for kw in IMPORTANT_DECISION_KEYWORDS)


def _normalize_ceo_approval(value: str | None) -> str:
    v = (value or "not_required").strip().lower()
    if v in CEO_APPROVAL_VALUES:
        return v
    return "not_required"


# --- Legacy API (backward compatible; writes also go to structured store) ---


def save_memory(category: str, content: str, source_agent: str | None = None) -> str:
    """Append a categorized note (legacy + structured agent_notes)."""
    agent = source_agent or "unknown"
    block = (
        f"\n## {_timestamp()}\n"
        f"- **Category:** {category.strip()}\n"
        f"- **Source:** {agent}\n"
        f"- **Content:** {content.strip()}\n"
    )
    _append_markdown(SHARED_MEMORY_FILE, block)
    return remember(
        category=category.strip().lower() or "general",
        content=content.strip(),
        source=agent,
        also_legacy=False,
    )


def save_decision(
    title: str,
    reason: str,
    decision: str,
    owner: str | None = None,
    *,
    ceo_approval: str = "not_required",
    source: str = "unknown",
) -> str:
    """Append a business decision (legacy + structured decisions/)."""
    owner_line = f"- **Owner:** {owner.strip()}\n" if owner else ""
    block = (
        f"\n## {title.strip()} — {_timestamp()}\n"
        f"- **Reason:** {reason.strip()}\n"
        f"- **Decision:** {decision.strip()}\n"
        f"{owner_line}"
    )
    _append_markdown(DECISIONS_FILE, block)
    return record_decision(
        title=title.strip(),
        reason=reason.strip(),
        decision=decision.strip(),
        owner=owner,
        ceo_approval=ceo_approval,
        source=source,
        also_legacy=False,
    )


def save_customer_note(
    customer: str,
    note: str,
    source_agent: str | None = None,
) -> str:
    """Append a customer note (legacy + structured customers/)."""
    agent = source_agent or "unknown"
    block = (
        f"\n## {customer.strip()} — {_timestamp()}\n"
        f"- **Source:** {agent}\n"
        f"- **Note:** {note.strip()}\n"
    )
    _append_markdown(CUSTOMERS_FILE, block)
    slug = _slug(customer)
    path = _subdir("customers") / f"{slug}.md"
    rel = f"customers/{slug}.md"
    block2 = (
        f"\n## {_timestamp()}\n"
        f"- **Customer:** {customer.strip()}\n"
        f"- **Source:** {agent}\n"
        f"- **Note:** {note.strip()}\n"
    )
    _append_markdown(path, block2)
    _index_add("customer", rel, customer.strip(), source=agent, keywords=[slug])
    return f"Saved customer note for {customer.strip()}"


def read_all_memory() -> dict[str, str]:
    """Read legacy markdown files plus index summary."""
    _ensure_memory_dir()
    result: dict[str, str] = {}
    for path in MEMORY_FILES:
        if path.exists():
            result[path.name] = path.read_text(encoding="utf-8")
        else:
            result[path.name] = ""
    idx = _load_index()
    result["index.json"] = json.dumps(idx, ensure_ascii=False, indent=2)
    return result


def search_memory(keyword: str) -> list[dict[str, str]]:
    """Search legacy files and structured memory directories."""
    needle = (keyword or "").strip().lower()
    if not needle:
        return []

    hits: list[dict[str, str]] = []

    for path in MEMORY_FILES:
        if not path.exists():
            continue
        for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            if needle in line.lower():
                hits.append({
                    "file": path.name,
                    "line": str(line_no),
                    "text": line.strip(),
                })

    for sub in SUBDIR_NAMES:
        base = _subdir(sub)
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*.md")):
            try:
                text = path.read_text(encoding="utf-8")
            except OSError:
                continue
            rel = str(path.relative_to(MEMORY_DIR))
            for line_no, line in enumerate(text.splitlines(), start=1):
                if needle in line.lower():
                    hits.append({
                        "file": rel,
                        "line": str(line_no),
                        "text": line.strip(),
                    })

    for entry in _load_index().get("entries", []):
        blob = " ".join([
            entry.get("title", ""),
            " ".join(entry.get("tags", [])),
            " ".join(entry.get("keywords", [])),
        ]).lower()
        if needle in blob:
            hits.append({
                "file": "index.json",
                "line": entry.get("id", ""),
                "text": f"[{entry.get('type')}] {entry.get('title')}",
            })

    return hits


# --- Persistent Memory Engine (APAI-005) ---


def remember(
    content: str,
    *,
    category: str = "general",
    source: str = "coo",
    tags: list[str] | None = None,
    project: str | None = None,
    also_legacy: bool = True,
) -> str:
    """Save a note to the appropriate structured memory folder."""
    body = (content or "").strip()
    if not body:
        raise ValueError("remember: content is required")

    cat = (category or "general").strip().lower()
    agent = source or "unknown"

    if cat == "company":
        path = _subdir("company") / f"{_today()}-{_slug(body[:32])}.md"
        rel = str(path.relative_to(MEMORY_DIR))
        block = (
            f"\n## {_timestamp()}\n"
            f"- **Source:** {agent}\n"
            f"- **Content:** {body}\n"
        )
        _append_markdown(path, block)
        _index_add("company", rel, body[:80], tags=tags, source=agent)
        label = "company"

    elif cat == "customer":
        name = (project or body.split(":", 1)[0]).strip()[:64]
        return save_customer_note(name, body, agent)

    elif cat == "supplier":
        slug = _slug(project or body[:32])
        path = _subdir("suppliers") / f"{slug}.md"
        rel = f"suppliers/{slug}.md"
        block = (
            f"\n## {_timestamp()}\n"
            f"- **Source:** {agent}\n"
            f"- **Note:** {body}\n"
        )
        _append_markdown(path, block)
        _index_add("supplier", rel, body[:80], tags=tags, source=agent, keywords=[slug])
        label = f"supplier/{slug}"

    elif cat == "project" or project:
        slug = _slug(project or body[:32])
        path = _subdir("projects") / f"{slug}.md"
        rel = f"projects/{slug}.md"
        if not path.exists():
            _write_markdown(path, f"# Project: {project or slug}\n\n")
        block = (
            f"\n## {_timestamp()}\n"
            f"- **Source:** {agent}\n"
            f"- **Update:** {body}\n"
        )
        _append_markdown(path, block)
        _index_add("project", rel, project or slug, tags=tags, source=agent, keywords=[slug])
        label = f"project/{slug}"

    else:
        path = _subdir("agent_notes") / f"{_today()}-{_slug(body[:24])}.md"
        rel = str(path.relative_to(MEMORY_DIR))
        block = (
            f"\n## {_timestamp()}\n"
            f"- **Category:** {cat}\n"
            f"- **Source:** {agent}\n"
            f"- **Content:** {body}\n"
        )
        _append_markdown(path, block)
        _index_add("agent_note", rel, body[:80], tags=tags or [cat], source=agent)
        label = f"agent_notes ({cat})"
        if also_legacy and cat in ("plan", "operations", "general", "inventory"):
            block_legacy = (
                f"\n## {_timestamp()}\n"
                f"- **Category:** {cat}\n"
                f"- **Source:** {agent}\n"
                f"- **Content:** {body}\n"
            )
            _append_markdown(SHARED_MEMORY_FILE, block_legacy)

    return f"Remembered [{label}] from {agent}"


def record_decision(
    title: str,
    reason: str,
    decision: str,
    owner: str | None = None,
    *,
    ceo_approval: str = "not_required",
    source: str = "coo",
    also_legacy: bool = True,
) -> str:
    """Record a decision in memory/decisions/ with CEO approval status."""
    title = (title or "").strip()
    reason = (reason or "").strip()
    decision = (decision or "").strip()
    if not title or not decision:
        raise ValueError("record_decision: title and decision are required")

    combined = f"{title} {reason} {decision}"
    approval = _normalize_ceo_approval(ceo_approval)
    if _is_important_decision(combined) and approval == "not_required":
        raise ValueError(
            "Important decision requires CEO approval status. "
            "Add '| approved', '| pending', or '| not_required' at the end."
        )

    slug = _slug(title)
    path = _subdir("decisions") / f"{_today()}-{slug}.md"
    rel = str(path.relative_to(MEMORY_DIR))
    owner_line = f"- **Owner:** {owner.strip()}\n" if owner else ""
    body = (
        f"# Decision: {title}\n\n"
        f"- **Date:** {_timestamp()}\n"
        f"- **Reason:** {reason}\n"
        f"- **Decision:** {decision}\n"
        f"{owner_line}"
        f"- **CEO Approval:** {approval}\n"
        f"- **Source:** {source}\n"
    )
    _write_markdown(path, body)
    _index_add(
        "decision", rel, title,
        ceo_approval=approval,
        source=source,
        keywords=[slug],
    )

    if also_legacy:
        owner_legacy = f"- **Owner:** {owner.strip()}\n" if owner else ""
        block = (
            f"\n## {title} — {_timestamp()}\n"
            f"- **Reason:** {reason}\n"
            f"- **Decision:** {decision}\n"
            f"- **CEO Approval:** {approval}\n"
            f"{owner_legacy}"
        )
        _append_markdown(DECISIONS_FILE, block)

    return f"Saved decision: {title} (CEO approval: {approval})"


def log_daily(
    summary: str,
    *,
    source: str = "coo",
    channel: str = "cli",
    inbound: str = "",
    outbound: str = "",
) -> str:
    """Append an entry to today's daily log."""
    body = (summary or "").strip()
    if not body and not inbound:
        raise ValueError("log_daily: summary or inbound text is required")

    path = _subdir("daily_logs") / f"{_today()}.md"
    rel = f"daily_logs/{_today()}.md"
    if not path.exists():
        _write_markdown(path, f"# Daily Log — {_today()}\n\n")

    block = f"\n## {_timestamp()} [{channel}] source={source}\n"
    if inbound:
        block += f"- **Inbound:** {inbound[:500]}\n"
    if outbound:
        block += f"- **Outbound:** {outbound[:500]}\n"
    if body:
        block += f"- **Summary:** {body}\n"
    _append_markdown(path, block)

    data = _load_index()
    if not any(e.get("path") == rel and e.get("type") == "daily_log" for e in data["entries"]):
        _index_add("daily_log", rel, f"Daily log {_today()}", source=source)

    return f"Logged to daily_logs/{_today()}.md"


def log_conversation(
    inbound: str,
    outbound: str,
    *,
    source: str = "coo",
    channel: str = "cli",
    important: bool = True,
) -> str | None:
    """Log an important conversation exchange to daily_logs."""
    if not important:
        return None
    if not (inbound or "").strip():
        return None
    summary = outbound[:200] if outbound else "(no reply)"
    return log_daily(
        summary=summary,
        source=source,
        channel=channel,
        inbound=inbound[:300],
        outbound=outbound[:300],
    )


def recall(keyword: str, limit: int = 8) -> str:
    """Search and format memory hits for CEO recall."""
    hits = search_memory(keyword)
    if not hits:
        return f"No memory found for: {keyword}"

    lines = [f"Recall results for «{keyword}» ({min(len(hits), limit)} shown):"]
    for hit in hits[:limit]:
        lines.append(f"- [{hit['file']}:{hit['line']}] {hit['text'][:200]}")
    if len(hits) > limit:
        lines.append(f"... and {len(hits) - limit} more")
    return "\n".join(lines)


def list_daily_log(date: str | None = None) -> str:
    """Return today's or a specific date's daily log."""
    day = (date or _today()).strip()
    path = _subdir("daily_logs") / f"{day}.md"
    if not path.is_file():
        return f"No daily log for {day}."
    return path.read_text(encoding="utf-8").strip()


def load_context_for_message(message: str, max_chars: int = 2000) -> str:
    """Load relevant memory excerpts for agent context (keyword-based)."""
    text = (message or "").strip()
    if not text:
        return ""

    tokens = re.findall(r"[\w\u4e00-\u9fff]{2,}", text.lower())
    tokens = list(dict.fromkeys(tokens))[:12]

    seen: set[str] = set()
    chunks: list[str] = []

    for token in tokens:
        for hit in search_memory(token):
            key = f"{hit['file']}:{hit['line']}"
            if key in seen:
                continue
            seen.add(key)
            chunks.append(f"- {hit['text'][:240]}")
            if sum(len(c) for c in chunks) >= max_chars:
                break
        if sum(len(c) for c in chunks) >= max_chars:
            break

    if not chunks:
        data = read_all_memory()
        shared = data.get("shared_memory.md", "").strip()
        decisions = data.get("decisions.md", "").strip()
        tail = "\n\n".join(p for p in (shared, decisions) if p)
        if tail:
            if len(tail) > max_chars:
                tail = tail[-max_chars:]
            return f"\n\nRecent memory (read-only context):\n{tail}"
        return ""

    blob = "\n".join(chunks)
    if len(blob) > max_chars:
        blob = blob[:max_chars] + "\n..."
    return f"\n\nRelevant memory (read-only context):\n{blob}"


def summarize_recent_decisions(max_entries: int = 8) -> list[str]:
    """Recent decision titles for reports."""
    entries = [
        e for e in _load_index().get("entries", [])
        if e.get("type") == "decision"
    ]
    if entries:
        return [
            f"{e.get('title', '?')} (CEO: {e.get('ceo_approval', '?')})"
            for e in entries[-max_entries:]
        ]

    data = read_all_memory()
    raw = data.get("decisions.md", "")
    if not raw.strip():
        return ["(none)"]
    lines = [ln.strip() for ln in raw.splitlines() if ln.strip().startswith("## ")]
    return lines[-max_entries:] if lines else ["(none)"]
