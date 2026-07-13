#!/usr/bin/env python3
"""Generate AsiaPower Brain daily ChatGPT export (brain-summary.md).

Reads Markdown under AsiaPower-Brain/ only. Does not touch business deploy paths.
Target length: roughly 1000–2000 Chinese characters (soft guidance).
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BRAIN = ROOT / "AsiaPower-Brain"
OUT = BRAIN / "exports" / "chatgpt" / "brain-summary.md"
TARGET_MIN = 1000
TARGET_MAX = 2000

WIKI_LINK = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")


def read_text(path: Path) -> str:
    if not path.is_file():
        return ""
    return path.read_text(encoding="utf-8")


def strip_fm(md: str) -> str:
    return re.sub(r"^---\n.*?\n---\n", "", md, count=1, flags=re.S).strip()


def first_heading(md: str) -> str:
    for line in strip_fm(md).splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return "(untitled)"


def list_md(folder: Path) -> list[Path]:
    if not folder.is_dir():
        return []
    return sorted(p for p in folder.rglob("*.md") if p.is_file())


def files_for_day(folder: Path, day: str, exclude_names: set[str] | None = None) -> list[Path]:
    exclude_names = exclude_names or set()
    hits = []
    for p in list_md(folder):
        if p.name in exclude_names:
            continue
        if day in p.name or day in read_text(p)[:1200]:
            hits.append(p)
    return hits


def resolve_wiki_targets(line: str) -> list[Path]:
    paths = []
    for m in WIKI_LINK.finditer(line):
        target = m.group(1).strip()
        cand = BRAIN / f"{target}.md"
        if cand.is_file():
            paths.append(cand)
            continue
        alt = BRAIN / target
        if alt.is_file():
            paths.append(alt)
    return paths


def summarize_file(path: Path, max_chars: int = 320) -> str:
    text = strip_fm(read_text(path))
    title = first_heading(text)
    lines: list[str] = []
    for ln in text.splitlines():
        s = ln.strip()
        if not s or s.startswith("#"):
            continue
        if re.match(r"^\|\s*[-:| ]+\s*\|?$", s):
            continue
        if s.startswith("|"):
            cells = [c.strip() for c in s.strip("|").split("|")]
            if len(cells) >= 2 and cells[0] in {
                "日期",
                "Decision",
                "Reason",
                "Evidence",
                "Owner",
                "Status",
                "议题",
                "决定",
                "影响面",
                "链接",
                "字段",
            }:
                if cells[0] == "字段":
                    continue
                lines.append(f"{cells[0]}：{cells[1]}")
            continue
        if s.startswith("## "):
            continue
        lines.append(s.lstrip("-* ").strip())
        if sum(len(x) for x in lines) > max_chars:
            break
    snippet = "；".join(lines)[:max_chars]
    rel = path.relative_to(BRAIN).as_posix()
    return f"- **{title}**（`{rel}`）：{snippet}" if snippet else f"- **{title}**（`{rel}`）"


def extract_daily_section(daily_text: str, headers: list[str]) -> list[str]:
    if not daily_text:
        return []
    for header in headers:
        pattern = rf"##\s*{re.escape(header)}\s*\n(.*?)(?=\n##\s|\Z)"
        m = re.search(pattern, daily_text, flags=re.S)
        if not m:
            continue
        block = m.group(1).strip()
        if not block:
            continue
        lines = [ln.rstrip() for ln in block.splitlines() if ln.strip()]
        if all(
            ("（无" in ln)
            or ln.strip() in {"- (无)", "- 无"}
            or "无新沉淀" in ln
            for ln in lines
        ):
            return []
        return lines
    return []


def expand_lines(lines: list[str]) -> list[str]:
    out: list[str] = []
    for ln in lines:
        targets = resolve_wiki_targets(ln)
        if targets:
            for t in targets:
                out.append(summarize_file(t))
            cleaned = WIKI_LINK.sub("", ln).strip(" -:")
            if cleaned and len(cleaned) > 4:
                out.append(f"- 备注：{cleaned}")
        else:
            out.append(ln if ln.lstrip().startswith("-") else f"- {ln}")
    return out


def section(title: str, bullets: list[str]) -> str:
    if not bullets:
        return f"## {title}\n\n- （无）\n"
    return f"## {title}\n\n" + "\n".join(bullets) + "\n"


def count_chars(text: str) -> int:
    return len(re.sub(r"\s+", "", text))


def build(day: str) -> str:
    daily_text = read_text(BRAIN / "10-Daily" / f"{day}.md")

    def _pick(headers: list[str], folder: Path, exclude: set[str]) -> list[str]:
        lines = extract_daily_section(daily_text, headers)
        if lines:
            return expand_lines(lines)
        files = files_for_day(folder, day, exclude)
        return [summarize_file(p) for p in files]

    risk_lines = extract_daily_section(daily_text, ["Risk", "新增 Risk"])
    risk_bullets = expand_lines(risk_lines) if risk_lines else ["- （无显式风险笔记）"]

    body_sections = [
        "# AsiaPower Brain — Daily Summary",
        "",
        f"**Date:** {day}",
        "**Audience:** ChatGPT / CTO context restore",
        f"**Length target:** {TARGET_MIN}–{TARGET_MAX} Chinese characters",
        "",
        "---",
        "",
        section(
            "1. 今天新增决策",
            _pick(["新增决策"], BRAIN / "06-Decisions", {"Decision-Log.md"}),
        ),
        section(
            "2. 新增 Lesson",
            _pick(["新增 Lesson"], BRAIN / "07-Lessons" / "library", {"Lesson-Library.md"}),
        ),
        section(
            "3. 新增 Architecture",
            _pick(["新增 Architecture"], BRAIN / "03-Architecture" / "library", set()),
        ),
        section(
            "4. 新增 Roadmap",
            _pick(["Roadmap", "新增 Roadmap"], BRAIN / "08-Roadmap", {"Roadmap.md"})
            or ["- 见 `08-Roadmap/Roadmap.md`（当日无独立变更笔记）"],
        ),
        section(
            "5. 新增 Vehicle Knowledge",
            _pick(
                ["Vehicle Knowledge", "新增 Vehicle Knowledge"],
                BRAIN / "12-Vehicle-Intelligence",
                {"Vehicle-Intelligence.md", "README.md"},
            )
            or ["- 无新车辆结论；VI 目录（VIN/OE/铭牌/照片）已就位"],
        ),
        section(
            "6. 新增 CEO Decision",
            _pick(
                ["CEO Decision / Review", "新增 CEO Decision"],
                BRAIN / "11-Knowledge" / "CEO-Review",
                {"CEO-Review.md"},
            ),
        ),
        section("7. 新增 Risk", risk_bullets),
        "---",
        "",
        "## 长期共识（压缩提醒）",
        "",
        "Business First · Evidence First · Decision First · Roadmap ≠ Production · "
        "Obsidian 唯一 Brain · Evidence 只存摘要 · Vehicle Intelligence 是能力不是愿景 · "
        "QXB ≠ APSales VIN · 生产须 commit→push→Release Manager。",
        "",
        "旧 `obsidian/AsiaPower-AI-Memory` 不作为第二 Brain；迁入前只读。",
        "",
        "---",
        "",
        f"*Generated by scripts/asiapower-brain-daily-export.py · source: AsiaPower-Brain · {day}*",
        "",
    ]

    text = "\n".join(body_sections)
    n = count_chars(text)
    if n > TARGET_MAX + 500:
        text += f"\n> NOTE: ~{n} chars（高于软上限 {TARGET_MAX}），下次压缩 Daily/Decision 正文。\n"
    elif n < TARGET_MIN:
        text += (
            f"\n> NOTE: ~{n} chars（低于软下限 {TARGET_MIN}）。"
            "起库日内容偏少属正常；有实质变更后摘要会变长。\n"
        )
    return text


def main() -> int:
    parser = argparse.ArgumentParser(description="AsiaPower Brain daily ChatGPT export")
    parser.add_argument("--date", default=dt.date.today().isoformat(), help="YYYY-MM-DD")
    parser.add_argument("--out", default=str(OUT), help="Output markdown path")
    args = parser.parse_args()

    if not BRAIN.is_dir():
        raise SystemExit(f"Brain vault not found: {BRAIN}")

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    body = build(args.date)
    out_path.write_text(body, encoding="utf-8")
    print(f"Wrote {out_path} ({count_chars(body)} non-whitespace chars)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
