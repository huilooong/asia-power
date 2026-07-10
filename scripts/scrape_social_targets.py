#!/usr/bin/env python3
"""Scrape Reddit/Quora search results for social target discovery."""

from __future__ import annotations

import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urljoin, urlparse

import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/121.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

SEARCH_URLS = [
    ("Reddit", "https://www.reddit.com/search/?q=used+engines+ghana+import&type=link"),
    ("Reddit", "https://www.reddit.com/search/?q=spare+parts+nigeria+import&type=link"),
    ("Quora", "https://www.quora.com/search?q=used+engines+import+ghana"),
]

OUTPUT = Path(__file__).resolve().parents[1] / "docs/agent-reports/social-targets.md"


def fetch(session: requests.Session, url: str) -> tuple[str, int]:
    resp = session.get(url, timeout=30, allow_redirects=True)
    return resp.text, resp.status_code


def clean_title(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def normalize_reddit_url(href: str) -> str:
    url = urljoin("https://www.reddit.com", href.split("?")[0])
    return url.replace("https://old.reddit.com", "https://www.reddit.com")


def reddit_old_mirror(url: str) -> str:
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    params: dict[str, str] = {
        "q": query.get("q", [""])[0],
        "restrict_sr": "",
        "sort": "relevance",
        "t": "all",
    }
    if query.get("type"):
        params["type"] = query["type"][0]
    return f"https://old.reddit.com/search/?{urlencode(params)}"


def is_reddit_verification_page(html: str) -> bool:
    lowered = html.lower()
    return "please wait for verification" in lowered or len(html) < 15000 and "shreddit" in lowered


def parse_reddit(html: str) -> list[tuple[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    results: list[tuple[str, str]] = []
    seen: set[str] = set()

    for sr in soup.select(".search-result"):
        title_a = sr.select_one("a.search-title")
        if not title_a:
            continue
        title = clean_title(title_a.get_text())
        href = title_a.get("href") or ""
        if not title or "/comments/" not in href:
            continue
        url = normalize_reddit_url(href)
        if url in seen:
            continue
        seen.add(url)
        results.append((title, url))

    if results:
        return results

    for a in soup.select('a[data-testid="post-title"], a[slot="title"]'):
        title = clean_title(a.get_text())
        href = a.get("href") or ""
        if not title or "/comments/" not in href:
            continue
        url = normalize_reddit_url(href)
        if url in seen:
            continue
        seen.add(url)
        results.append((title, url))

    return results


def parse_quora(html: str) -> list[tuple[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    results: list[tuple[str, str]] = []
    seen: set[str] = set()

    question_prefixes = ("/What-", "/How-", "/Where-", "/Which-", "/Can-", "/Is-", "/Why-")
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if not (href.startswith("/") or "quora.com" in href):
            continue
        if not any(seg in href for seg in question_prefixes):
            continue
        title = clean_title(a.get_text())
        if len(title) < 12:
            continue
        url = urljoin("https://www.quora.com", href.split("?")[0])
        if url in seen:
            continue
        seen.add(url)
        results.append((title, url))

    return results


def scrape_reddit(session: requests.Session, url: str) -> tuple[list[tuple[str, str]], str]:
    html, status = fetch(session, url)
    if status == 200 and not is_reddit_verification_page(html):
        items = parse_reddit(html)
        if items:
            return items, f"HTTP {status}"

    mirror = reddit_old_mirror(url)
    html, status = fetch(session, mirror)
    if status != 200:
        return [], f"HTTP {status} (verification page on www; mirror failed)"
    items = parse_reddit(html)
    note = f"HTTP {status} via old.reddit mirror (www returned bot verification page)"
    return items, note


def scrape_quora(session: requests.Session, url: str) -> tuple[list[tuple[str, str]], str]:
    html, status = fetch(session, url)
    if status != 200:
        return [], f"HTTP {status} (Cloudflare challenge; login required)"
    items = parse_quora(html)
    if items:
        return items, f"HTTP {status}"
    return [], f"HTTP {status} (no question links parsed)"


def scrape_all() -> tuple[list[tuple[str, str, str]], list[tuple[str, str, str]]]:
    session = requests.Session()
    session.headers.update(HEADERS)
    session.get("https://www.reddit.com/", timeout=30)

    rows: list[tuple[str, str, str]] = []
    notes: list[tuple[str, str, str]] = []

    for platform, url in SEARCH_URLS:
        if platform == "Reddit":
            items, note = scrape_reddit(session, url)
        else:
            items, note = scrape_quora(session, url)

        notes.append((platform, url, note))
        if not items:
            rows.append((platform, f"(no results: {note})", url))
            continue
        for title, item_url in items:
            rows.append((platform, title, item_url))

    return rows, notes


def write_report(rows: list[tuple[str, str, str]], notes: list[tuple[str, str, str]]) -> None:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "# Social Targets — Reddit & Quora",
        "",
        f"Generated: {now}",
        "",
        "Method: Python `requests` + BeautifulSoup",
        "",
        "## Search URLs",
        "",
    ]
    for platform, url in SEARCH_URLS:
        lines.append(f"- **{platform}**: {url}")
    lines.extend(["", "## Fetch notes", ""])
    for platform, url, note in notes:
        lines.append(f"- **{platform}** `{url}` → {note}")
    lines.extend(["", "## Results", "", "平台|标题|URL", "---|---|---"])
    for platform, title, item_url in rows:
        safe_title = title.replace("|", "/")
        lines.append(f"{platform}|{safe_title}|{item_url}")
    lines.append("")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    rows, notes = scrape_all()
    write_report(rows, notes)
    print(f"Wrote {len(rows)} rows to {OUTPUT}")
    for platform, url, note in notes:
        print(f"  {platform}: {note}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
