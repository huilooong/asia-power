#!/usr/bin/env python3
"""AsiaPower Brain Update receiver — mechanical only.

Receive standard Brain Update → save by Category → update Index → git → export.
No AI. No content judgment. No rewrite. No summarize.
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BRAIN = (ROOT / "AsiaPower-Brain").resolve()
INBOX_PENDING = BRAIN / "inbox" / "pending"
INBOX_DONE = BRAIN / "inbox" / "done"
EXPORT_SCRIPT = ROOT / "scripts" / "asiapower-brain-daily-export.py"

# Category → (rel_dir, index_rel, index_kind)
# index_kind controls row shape only — not content judgment.
ROUTES: dict[str, tuple[str, str, str]] = {
    "decision": ("06-Decisions/log", "06-Decisions/Decision-Log.md", "decision"),
    "lesson": ("07-Lessons/library", "07-Lessons/Lesson-Library.md", "lesson"),
    "architecture": (
        "03-Architecture/library",
        "03-Architecture/Architecture-Library.md",
        "architecture",
    ),
    "ceo-review": (
        "11-Knowledge/CEO-Review",
        "11-Knowledge/CEO-Review/CEO-Review.md",
        "ceo_review",
    ),
    "evidence-summary": (
        "11-Knowledge/Evidence-Summaries",
        "11-Knowledge/Evidence-Summaries/Evidence-Summaries.md",
        "evidence",
    ),
    "vehicle-knowledge": (
        "05-Products/Vehicle-Intelligence",
        "05-Products/Vehicle-Intelligence/Vehicle-Intelligence.md",
        "vehicle",
    ),
    "roadmap": ("08-Roadmap", "08-Roadmap/Roadmap.md", "roadmap"),
    "meeting": ("09-Meeting", "09-Meeting/Meetings.md", "meeting"),
    "daily": ("10-Daily", "10-Daily/Daily.md", "daily"),
    "risk": ("10-Daily", "10-Daily/Daily.md", "risk"),
}

ENTRY_DIRS = {
    "vin": "VIN",
    "oe": "OE",
    "engine-plate": "Engine-Plate",
    "engine_plate": "Engine-Plate",
    "transmission-plate": "Transmission-Plate",
    "transmission_plate": "Transmission-Plate",
    "vehicle-photo": "Vehicle-Photo",
    "vehicle_photo": "Vehicle-Photo",
    "summaries": "Summaries",
    "summary": "Summaries",
}

HEADER_KEYS = ("category", "date", "title", "slug", "owner", "status", "entry")


def fail(msg: str, code: int = 1) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    raise SystemExit(code)


def normalize_category(raw: str) -> str:
    s = raw.strip().lower().replace("_", "-").replace(" ", "-")
    aliases = {
        "ceo-decision": "ceo-review",
        "ceoreview": "ceo-review",
        "evidence": "evidence-summary",
        "vehicle": "vehicle-knowledge",
        "vehicleintelligence": "vehicle-knowledge",
        "vehicle-intelligence": "vehicle-knowledge",
    }
    return aliases.get(s, s)


def slugify(text: str) -> str:
    t = text.strip().lower()
    t = re.sub(r"\s+", "-", t)
    t = re.sub(r"[^\w\-\u4e00-\u9fff]+", "", t, flags=re.UNICODE)
    t = t.strip("-")[:80]
    return t or "update"


def parse_update(text: str) -> tuple[dict[str, str], str]:
    """Parse header fields + body after first --- following headers. Body untouched."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    # Optional YAML frontmatter — discarded as envelope only; not part of saved body.
    if text.startswith("---\n"):
        m = re.match(r"^---\n.*?\n---\n", text, flags=re.S)
        if m:
            text = text[m.end() :]
    lines = text.split("\n")
    fields: dict[str, str] = {}
    i = 0
    # skip leading empty / title line "# Brain Update"
    while i < len(lines) and not lines[i].strip():
        i += 1
    if i < len(lines) and lines[i].strip().lower() in {"# brain update", "#brain update"}:
        i += 1
    while i < len(lines) and not lines[i].strip():
        i += 1

    while i < len(lines):
        line = lines[i]
        if line.strip() == "---":
            i += 1
            break
        if not line.strip():
            i += 1
            continue
        m = re.match(r"^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$", line)
        if not m:
            # Not a header field and no --- yet → treat remainder as body (no rewrite)
            break
        key = m.group(1).strip().lower()
        val = m.group(2).strip()
        if key in HEADER_KEYS:
            fields[key] = val
        i += 1

    body = "\n".join(lines[i:])
    # Preserve body exactly; only strip a single leading newline if --- consumed
    if body.startswith("\n"):
        body = body[1:]
    return fields, body


def ensure_required(fields: dict[str, str]) -> None:
    for k in ("category", "date", "title"):
        if not fields.get(k, "").strip():
            fail(f"missing required field: {k}")
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", fields["date"]):
        fail(f"Date must be YYYY-MM-DD, got: {fields['date']}")


def target_paths(fields: dict[str, str]) -> tuple[Path, Path, str, str]:
    cat = normalize_category(fields["category"])
    if cat not in ROUTES:
        allowed = ", ".join(sorted(ROUTES))
        fail(f"unknown Category: {fields['category']!r} (allowed: {allowed})")
    rel_dir, index_rel, kind = ROUTES[cat]
    date = fields["date"]
    slug = fields.get("slug") or slugify(fields["title"])
    filename = f"{date}-{slug}.md"
    if cat == "daily" and not fields.get("slug"):
        filename = f"{date}.md"

    dest_dir = BRAIN / rel_dir
    if cat == "vehicle-knowledge":
        entry_raw = fields.get("entry", "").strip()
        if entry_raw:
            entry_key = entry_raw.lower().replace("_", "-").replace(" ", "-")
            sub = ENTRY_DIRS.get(entry_key)
            if not sub:
                fail(
                    f"unknown Entry for Vehicle-Knowledge: {entry_raw!r} "
                    f"(allowed: {', '.join(sorted(set(ENTRY_DIRS.values())))})"
                )
            dest_dir = dest_dir / sub

    dest = dest_dir / filename
    index_path = BRAIN / index_rel
    note_rel = dest.relative_to(BRAIN).as_posix()
    note_link = note_rel[: -len(".md")] if note_rel.endswith(".md") else note_rel
    return dest, index_path, kind, note_link


def index_row(kind: str, fields: dict[str, str], note_link: str) -> str:
    title = fields["title"].replace("|", "/")
    date = fields["date"]
    owner = fields.get("owner", "").replace("|", "/")
    status = fields.get("status", "").replace("|", "/")
    stem = Path(note_link).name
    link = f"[[{note_link}|{stem}]]"
    if kind == "decision":
        return f"| {date} | {title} | {owner} | {status} | {link} |"
    if kind == "architecture":
        st = status or "Active"
        return f"| {title} | {link} | {st} |"
    if kind in {"lesson", "evidence", "meeting", "roadmap", "ceo_review", "vehicle", "daily", "risk"}:
        return f"| {date} | {title} | {link} |"
    fail(f"internal: unknown index kind {kind}")


def append_index_row(index_path: Path, row: str) -> None:
    if not index_path.is_file():
        fail(f"index file missing: {index_path}")
    text = index_path.read_text(encoding="utf-8")
    if row in text:
        return  # idempotent; no rewrite of existing rows

    # Append after last table row under ## 索引 (or ## Index), before next ## or EOF
    m = re.search(r"(##\s*索引\b.*?)(\n##\s|\Z)", text, flags=re.S | re.I)
    if not m:
        m = re.search(r"(##\s*Index\b.*?)(\n##\s|\Z)", text, flags=re.S | re.I)
    if not m:
        # Roadmap / Vehicle may lack 索引 — append ## 索引 block at end
        addition = "\n\n## 索引\n\n| 日期 | 标题 | 笔记 |\n|------|------|------|\n" + row + "\n"
        index_path.write_text(text.rstrip() + addition + "\n", encoding="utf-8")
        return

    block = m.group(1)
    suffix = m.group(2)
    # Find last markdown table row in block
    lines = block.split("\n")
    insert_at = len(lines)
    for idx in range(len(lines) - 1, -1, -1):
        if lines[idx].startswith("|"):
            insert_at = idx + 1
            break
    lines.insert(insert_at, row)
    new_block = "\n".join(lines)
    start, end = m.start(1), m.end(1)
    new_text = text[:start] + new_block + text[end:]
    # m.end(1) already excludes suffix group start; restore carefully
    # Actually text[end:] starts at group 2; group1 replacement shouldn't drop group2
    # end = m.end(1) means text[end:] == suffix + rest — good if we use end correctly
    index_path.write_text(new_text, encoding="utf-8")


def git_commit(paths: list[Path], message: str) -> None:
    if not (BRAIN / ".git").exists():
        fail(f"Brain git repo not found at {BRAIN}")
    rels = [str(p.resolve()) for p in paths]
    subprocess.run(["git", "add", "--"] + rels, cwd=BRAIN, check=True)
    # Also add index if not in list
    staged = subprocess.run(
        ["git", "status", "--porcelain"], cwd=BRAIN, check=True, capture_output=True, text=True
    )
    if not staged.stdout.strip():
        print("GIT: nothing to commit")
        return
    subprocess.run(["git", "commit", "-m", message], cwd=BRAIN, check=True)
    print(f"GIT: committed — {message}")


def run_export(date: str) -> None:
    if not EXPORT_SCRIPT.is_file():
        fail(f"export script missing: {EXPORT_SCRIPT}")
    subprocess.run(
        [sys.executable, str(EXPORT_SCRIPT), "--date", date],
        cwd=ROOT,
        check=True,
    )
    # commit export artifact
    export_path = BRAIN / "exports" / "chatgpt" / "brain-summary.md"
    subprocess.run(["git", "add", "--", str(export_path)], cwd=BRAIN, check=True)
    porcelain = subprocess.run(
        ["git", "status", "--porcelain", str(export_path)],
        cwd=BRAIN,
        check=True,
        capture_output=True,
        text=True,
    )
    if porcelain.stdout.strip():
        subprocess.run(
            ["git", "commit", "-m", f"export: brain-summary {date}"],
            cwd=BRAIN,
            check=True,
        )
        print(f"GIT: export committed for {date}")


def receive_one(src: Path, move_done: bool = False) -> Path:
    raw = src.read_text(encoding="utf-8")
    fields, body = parse_update(raw)
    ensure_required(fields)
    dest, index_path, kind, note_link = target_paths(fields)
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        fail(f"target already exists (refusing overwrite): {dest}")

    # Save body as-is. If body empty, save empty file (still no rewrite of provided text).
    dest.write_text(body, encoding="utf-8")
    row = index_row(kind, fields, note_link)
    append_index_row(index_path, row)

    cat = normalize_category(fields["category"])
    msg = f"brain-update: {cat} {fields['date']}-{fields.get('slug') or slugify(fields['title'])}"
    git_commit([dest, index_path], msg)
    run_export(fields["date"])

    if move_done:
        INBOX_DONE.mkdir(parents=True, exist_ok=True)
        done_path = INBOX_DONE / src.name
        if done_path.exists():
            done_path = INBOX_DONE / f"{src.stem}-{dt.datetime.now().strftime('%H%M%S')}{src.suffix}"
        shutil.move(str(src), str(done_path))
        print(f"INBOX: moved to {done_path}")

    print(f"OK: saved {dest}")
    print(f"OK: index {index_path}")
    return dest


def main() -> int:
    parser = argparse.ArgumentParser(description="AsiaPower Brain Update receiver (mechanical)")
    parser.add_argument("file", nargs="?", help="Path to a Brain Update markdown file")
    parser.add_argument(
        "--inbox",
        action="store_true",
        help=f"Process all *.md in {INBOX_PENDING}",
    )
    args = parser.parse_args()

    if not BRAIN.is_dir():
        fail(f"Brain not found: {BRAIN}")

    if args.inbox:
        INBOX_PENDING.mkdir(parents=True, exist_ok=True)
        files = sorted(INBOX_PENDING.glob("*.md"))
        if not files:
            print("INBOX: empty")
            return 0
        for f in files:
            receive_one(f, move_done=True)
        return 0

    if not args.file:
        fail("provide a file path or --inbox")
    src = Path(args.file).expanduser().resolve()
    if not src.is_file():
        fail(f"file not found: {src}")
    receive_one(src, move_done=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
