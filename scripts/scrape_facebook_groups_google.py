#!/usr/bin/env python3
"""Scrape Facebook group links from Google (and fallback) search result pages."""

from __future__ import annotations

import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, quote_plus, unquote, urlparse

import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/121.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

SEARCHES = [
    ("auto parts ghana", "site:facebook.com/groups 'auto parts' ghana"),
    ("spare parts nigeria", "site:facebook.com/groups 'spare parts' nigeria"),
    ("used engines africa", "site:facebook.com/groups 'used engines' africa"),
    ("car parts kenya", "site:facebook.com/groups 'car parts' kenya"),
    (
        "combined",
        "site:facebook.com/groups auto parts ghana nigeria kenya africa",
    ),
]

OUTPUT = Path(__file__).resolve().parents[1] / "docs/agent-reports/facebook-groups.md"

GROUP_RE = re.compile(
    r"https?://(?:www\.|m\.)?facebook\.com/groups/([A-Za-z0-9._-]+)",
    re.I,
)
SKIP_SLUGS = {"search", "feed", "discover", "create", "joins", "pending", "members"}


def google_search_url(query: str) -> str:
    return f"https://www.google.com/search?q={quote_plus(query)}&num=50&hl=en"


def brave_search_url(query: str) -> str:
    return f"https://search.brave.com/search?q={quote_plus(query)}&source=web"


def normalize_group_url(raw: str) -> str | None:
    m = GROUP_RE.search(raw)
    if not m:
        return None
    slug = m.group(1)
    if slug.lower() in SKIP_SLUGS:
        return None
    return f"https://www.facebook.com/groups/{slug}"


def extract_from_href(href: str) -> str | None:
    if not href:
        return None
    if href.startswith("/url?"):
        parsed = parse_qs(urlparse(href).query)
        target = parsed.get("q", [""])[0]
        return normalize_group_url(unquote(target))
    if "google.com" in href or "brave.com" in href:
        return None
    return normalize_group_url(unquote(href))


def extract_groups_from_html(html: str) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()

    def add(url: str | None) -> None:
        if not url or url in seen:
            return
        seen.add(url)
        found.append(url)

    for match in GROUP_RE.finditer(html):
        add(normalize_group_url(match.group(0)))

    soup = BeautifulSoup(html, "html.parser")
    for a in soup.find_all("a", href=True):
        add(extract_from_href(a["href"]))

    return found


def fetch(
    session: requests.Session,
    url: str,
    retries: int = 3,
    pause: float = 4.0,
) -> tuple[str, int]:
    last_status = 0
    last_text = ""
    for attempt in range(retries):
        if attempt:
            time.sleep(pause * attempt)
        resp = session.get(url, timeout=45, allow_redirects=True)
        last_status = resp.status_code
        last_text = resp.text
        if last_status == 200:
            return last_text, last_status
        if last_status not in {429, 503}:
            break
    return last_text, last_status


def scrape_query(
    session: requests.Session,
    query: str,
) -> tuple[list[str], list[tuple[str, str, int, str]]]:
    """Try Google first, then Brave fallback. Returns groups + fetch notes."""
    notes: list[tuple[str, str, int, str]] = []
    groups: list[str] = []
    seen: set[str] = set()

    google_url = google_search_url(query)
    html, status = fetch(session, google_url)
    google_groups = extract_groups_from_html(html) if status == 200 else []
    if status == 200 and not google_groups:
        if "enablejs" in html.lower() or "if you're having trouble accessing google search" in html.lower():
            note = "HTTP 200 但页面需 JS 渲染，未解析到群组链接"
        else:
            note = "HTTP 200，未解析到群组链接"
    elif status == 429:
        note = "HTTP 429 限流"
    else:
        note = f"HTTP {status}"
    notes.append(("Google", google_url, status, note))

    for url in google_groups:
        if url not in seen:
            seen.add(url)
            groups.append(url)

    if groups:
        return groups, notes

    brave_url = brave_search_url(query)
    html, status = fetch(session, brave_url, retries=4, pause=6.0)
    brave_groups = extract_groups_from_html(html) if status == 200 else []
    if status == 200 and brave_groups:
        note = f"HTTP 200，解析 {len(brave_groups)} 条（Google 无结果时的备用源，同等 site: 查询）"
    elif status == 429:
        note = "HTTP 429 限流"
    else:
        note = f"HTTP {status}，未解析到群组链接"
    notes.append(("Brave", brave_url, status, note))

    for url in brave_groups:
        if url not in seen:
            seen.add(url)
            groups.append(url)

    return groups, notes


def scrape_all() -> tuple[dict[str, list[str]], list[tuple[str, str, str, list[tuple[str, str, int, str]]]]]:
    session = requests.Session()
    session.headers.update(HEADERS)
    session.get("https://www.google.com/ncr", timeout=20)

    by_query: dict[str, list[str]] = {}
    run_notes: list[tuple[str, str, str, list[tuple[str, str, int, str]]]] = []

    for label, query in SEARCHES:
        time.sleep(2)
        groups, notes = scrape_query(session, query)
        by_query[label] = groups
        run_notes.append((label, query, google_search_url(query), notes))
        print(f"  {label}: {len(groups)} groups")

    return by_query, run_notes


def merge_unique(by_query: dict[str, list[str]]) -> list[tuple[str, list[str]]]:
    merged: list[tuple[str, list[str]]] = []
    seen: set[str] = set()
    for label, _query in SEARCHES:
        for url in by_query.get(label, []):
            if url in seen:
                continue
            seen.add(url)
            merged.append((url, [label]))
    return merged


def write_report(
    by_query: dict[str, list[str]],
    run_notes: list[tuple[str, str, str, list[tuple[str, str, int, str]]]],
) -> None:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    merged = merge_unique(by_query)

    lines = [
        "# Facebook Groups — Google Search",
        "",
        f"Generated: {now}",
        "",
        "Method: Python `requests` + BeautifulSoup",
        "",
        "说明：优先抓取 Google 搜索结果页；若 Google 返回 JS 页或 429 限流，则用 **同等 `site:facebook.com/groups` 查询** 在 Brave Search 备用页解析链接。",
        "",
        "## 搜索关键词",
        "",
    ]
    for label, query in SEARCHES:
        lines.append(f"- **{label}**: `{query}`")
    lines.append("")
    lines.append("合并查询 URL：")
    lines.append(
        "- https://www.google.com/search?q=site:facebook.com/groups+auto+parts+ghana+nigeria+kenya+africa"
    )
    lines.extend(["", "## 各关键词命中数", "", "| 关键词 | 群组数 |", "| --- | ---: |"])
    for label, _query in SEARCHES:
        lines.append(f"| {label} | {len(by_query.get(label, []))} |")
    lines.extend(["", f"去重后合计：**{len(merged)}** 条", "", "## 抓取说明", ""])
    for label, query, google_url, notes in run_notes:
        lines.append(f"### {label}")
        lines.append(f"- 查询：`{query}`")
        lines.append(f"- Google：{google_url}")
        for engine, url, status, note in notes:
            lines.append(f"- **{engine}** → HTTP {status} — {note}")
            if engine == "Brave":
                lines.append(f"  - 备用 URL：{url}")
        lines.append("")

    lines.extend(["## URL 列表（facebook.com/groups/）", ""])
    if merged:
        for url, sources in merged:
            src = ", ".join(sources)
            lines.append(f"{url}  <!-- {src} -->")
    else:
        lines.append("（未解析到任何群组链接）")
    lines.append("")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    by_query, run_notes = scrape_all()
    write_report(by_query, run_notes)
    merged = merge_unique(by_query)
    print(f"Wrote {len(merged)} unique groups to {OUTPUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
