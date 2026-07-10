#!/usr/bin/env python3
"""Generate CEO morning engine-demand report — no fluff, data only.

Output: reports/morning-engine-demand-YYYY-MM-DD.md
Schedule: UTC 08:00 (deploy/cron/morning-engine-demand.cron)

Columns: 国家 | 发动机型号 | 找货人数 | 询价次数 | 利差/价差 | 数据来源
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _load_aggregate_module():
    import importlib.util

    path = ROOT / "scripts" / "aggregate-market-intelligence.py"
    spec = importlib.util.spec_from_file_location("aggregate_market_intelligence", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_AGG = _load_aggregate_module()
CONV_DIR = _AGG.CONV_DIR
ENGINE_RE = _AGG.ENGINE_RE
MODEL_PATTERNS = _AGG.MODEL_PATTERNS
WP_DIR = _AGG.WP_DIR
CATALOG_RE = re.compile(r"到货清单|独立卡片|index\.html|GHS\s*\d", re.I)
detect_country = _AGG.detect_country
is_stub = _AGG.is_stub
load_json = _AGG.load_json

FB_INTEL = ROOT / "memory" / "customer_gateway" / "fb_friends_market_intel.jsonl"
FB_DM_LOG = ROOT / "memory" / "customer_gateway" / "fb_friend_dm_log.jsonl"
REPORTS_DIR = ROOT / "reports"
DEPRECATED_REPORTS = (
    "middle-east-africa-halfcut-market-2026-07-04.md",
    "africa-me-halfcut-intelligence-2026-07-04.md",
    "whatsapp_sales_intelligence_full.md",
)

COUNTRY_ALIASES = {
    "ghana": "Ghana",
    "nigeria": "Nigeria",
    "kenya": "Kenya",
    "togo": "Togo",
    "uae": "UAE",
    "other": "unknown",
    "unknown": "unknown",
    "china": "China",
    "zimbabwe": "Zimbabwe",
}


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _today_str() -> str:
    return _now_utc().strftime("%Y-%m-%d")


def _normalize_country(raw: str) -> str:
    text = (raw or "").strip()
    if not text:
        return "unknown"
    low = text.lower()
    if low in COUNTRY_ALIASES:
        return COUNTRY_ALIASES[low]
    if text in COUNTRY_ALIASES.values():
        return text
    return text.title() if text.islower() else text


def _normalize_engine(code: str) -> str:
    c = (code or "").strip().upper()
    c = c.replace("-FE", "-FE").replace("-FTV", "-FTV")
    if not c:
        return ""
    if re.fullmatch(r"HR\d{2}", c):
        return f"{c}DE"
    return c


def _engines_from_text(text: str) -> set[str]:
    codes: set[str] = set()
    for m in ENGINE_RE.findall(text or ""):
        norm = _normalize_engine(m)
        if norm:
            codes.add(norm)
    tl = (text or "").lower()
    if any(x in tl for x in ("engine", "半切", "half cut", "halfcut", "机")):
        for _name, pat in MODEL_PATTERNS:
            if pat.search(text or ""):
                codes.add(_name)
    return codes


def _leads_file() -> Path | None:
    env = os.getenv("EMAIL_DATA_DIR", "").strip()
    if env:
        p = Path(env) / "contact-leads.json"
        if p.is_file():
            return p
    inv = os.getenv("INVENTORY_SITE_ROOT", "").strip()
    if inv:
        p = Path(inv) / "data" / "contact-leads.json"
        if p.is_file():
            return p
    for candidate in (
        ROOT / "data" / "contact-leads.json",
        ROOT.parent / "inventory-site" / "data" / "contact-leads.json",
    ):
        if candidate.is_file():
            return candidate
    return None


def _fetch_remote_leads() -> list[dict[str, Any]]:
    """Pull contact-leads.json from production when local copy missing."""
    if _leads_file():
        return []
    host = os.getenv("PRODUCTION_SSH", "root@159.65.86.24")
    remote = "/root/.openclaw/workspace/inventory-site/data/contact-leads.json"
    try:
        proc = subprocess.run(
            ["ssh", "-o", "ConnectTimeout=8", host, f"cat {remote}"],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
        if proc.returncode != 0 or not proc.stdout.strip():
            return []
        data = json.loads(proc.stdout)
        return data if isinstance(data, list) else list(data.get("leads") or [])
    except (json.JSONDecodeError, subprocess.TimeoutExpired, OSError):
        return []


def _load_leads() -> list[dict[str, Any]]:
    path = _leads_file()
    if path:
        data = load_json(path)
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            return list(data.get("leads") or [])
    return _fetch_remote_leads()


@dataclass
class DemandRow:
    country: str
    engine: str
    contacts: set[str] = field(default_factory=set)
    enquiries: int = 0
    buy_prices: list[float] = field(default_factory=list)
    sell_prices: list[float] = field(default_factory=list)
    sources: set[str] = field(default_factory=set)

    def add_contact(self, contact: str, source: str, enquiries: int = 0) -> None:
        key = (contact or "").strip().lower()
        if not key:
            key = f"anon-{source}-{enquiries}"
        self.contacts.add(key)
        self.enquiries += max(0, enquiries)
        self.sources.add(source)

    def spread_label(self) -> str:
        buys = [p for p in self.buy_prices if p > 0]
        sells = [p for p in self.sell_prices if p > 0]
        if not buys or not sells:
            return "无数据"
        buy = sum(buys) / len(buys)
        sell = sum(sells) / len(sells)
        delta = sell - buy
        return f"USD {delta:,.0f} (卖{sell:,.0f}−买{buy:,.0f})"


class DemandAggregator:
    def __init__(self) -> None:
        self.rows: dict[tuple[str, str], DemandRow] = {}
        self.countries_seen: set[str] = set()
        self._wa_contacts: set[str] = set()

    def _contact_key(self, contact: str) -> str:
        return (contact or "").strip().lower()

    def _row(self, country: str, engine: str) -> DemandRow:
        c = _normalize_country(country)
        e = engine.strip()
        key = (c, e)
        if key not in self.rows:
            self.rows[key] = DemandRow(country=c, engine=e)
        self.countries_seen.add(c)
        return self.rows[key]

    def ingest_whatsapp_conversations(self) -> int:
        count = 0
        if not CONV_DIR.is_dir():
            return 0
        for path in sorted(CONV_DIR.glob("*.json")):
            conv = load_json(path)
            if not conv or is_stub(conv):
                continue
            count += 1
            contact = conv.get("contact", path.stem)
            self._wa_contacts.add(self._contact_key(contact))
            country = detect_country(contact)
            cust_codes: set[str] = set()
            enquiry_n = 0
            sell_prices: list[float] = []

            for msg in conv.get("messages", []):
                if msg.get("is_ceo"):
                    continue
                text = msg.get("text", "") or ""
                cat = msg.get("category", "")
                if cat in ("enquiry", "price_request", "availability_check"):
                    enquiry_n += 1
                codes = {m.upper().replace("-FE", "").replace("-FTV", "").replace("DE", "")
                         for m in ENGINE_RE.findall(text)}
                if len(codes) >= 3 or CATALOG_RE.search(text):
                    continue
                for code in codes:
                    norm = _normalize_engine(code)
                    if norm:
                        cust_codes.add(norm)
                for pat in (
                    re.compile(r"fob\s*(?:price\s*)?(\d{3,6})", re.I),
                    re.compile(r"USD\s*(\d{3,6})", re.I),
                    re.compile(r"(\d{4,5})\s*usd", re.I),
                ):
                    m = pat.search(text)
                    if m:
                        try:
                            sell_prices.append(float(m.group(1).replace(",", "")))
                        except ValueError:
                            pass

            if not cust_codes and enquiry_n:
                cust_codes.add("(车型未识别)")
            for code in cust_codes:
                row = self._row(country, code)
                row.add_contact(contact, "whatsapp_conv", enquiries=1 if enquiry_n else 0)
                if sell_prices:
                    row.sell_prices.extend(sell_prices[:3])
        return count

    def ingest_whatsapp_parsed(self) -> int:
        """Supplement conversations only — skip samples and already-known contacts."""
        files = 0
        if not WP_DIR.is_dir():
            return 0
        for path in WP_DIR.glob("*.json"):
            if "samp" in path.name.lower() or "sample" in path.name.lower():
                continue
            data = load_json(path) or {}
            contact = data.get("contact", path.stem)
            ck = self._contact_key(contact)
            if ck in self._wa_contacts:
                continue
            files += 1
            country = detect_country(contact)
            codes: set[str] = set()
            enquiry_n = 0
            for msg in data.get("messages", []):
                if msg.get("is_ceo"):
                    continue
                text = msg.get("text", "") or ""
                found = _engines_from_text(text)
                found = {c for c in found if c not in ("ENGINE", "(车型未识别)")}
                codes |= found
                if msg.get("category") in ("enquiry", "price_request"):
                    enquiry_n += 1
            if not codes:
                continue
            for code in codes:
                self._row(country, code).add_contact(
                    contact, "whatsapp_parsed", enquiries=1 if enquiry_n else 0
                )
        return files

    def ingest_fb_intel(self) -> int:
        if not FB_INTEL.is_file():
            return 0
        n = 0
        for line in FB_INTEL.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not isinstance(row, dict):
                continue
            n += 1
            author = row.get("author") or row.get("friend") or f"fb-{n}"
            if str(author).startswith("http"):
                continue
            country = _normalize_country(row.get("detected_country") or "unknown")
            codes = {_normalize_engine(c) for c in row.get("detected_engine_codes") or []}
            codes = {c for c in codes if c}
            if not codes:
                text_codes = _engines_from_text(row.get("text", ""))
                codes = text_codes
            if not codes:
                continue
            enquiry = 1 if row.get("potential_lead") or row.get("keywords_matched") else 0
            for code in codes:
                self._row(country, code).add_contact(author, "fb_intel", enquiries=enquiry or 1)
        return n

    def ingest_fb_dm_replies(self) -> int:
        """DM log: count inbound reply signals when present; else skip outbound-only."""
        if not FB_DM_LOG.is_file():
            return 0
        n = 0
        for line in FB_DM_LOG.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            status = str(row.get("status") or "").lower()
            if status not in ("replied", "reply"):
                continue
            n += 1
            contact = row.get("friend_id") or row.get("name") or f"fb-dm-{n}"
            country = _normalize_country(row.get("country") or "unknown")
            codes = _engines_from_text(row.get("reply_text") or row.get("message_preview") or "")
            for code in codes or {"(回复未识别)"}:
                self._row(country, code).add_contact(contact, "fb_dm_reply", enquiries=1)
        return n

    def ingest_website_leads(self) -> int:
        leads = _load_leads()
        n = 0
        for lead in leads:
            n += 1
            contact = lead.get("email") or lead.get("phone") or lead.get("name") or lead.get("id")
            country = _normalize_country(
                lead.get("country") or lead.get("ipCountry") or "unknown"
            )
            engine = (
                _normalize_engine(lead.get("engineCode") or "")
                or (lead.get("productLabel") or lead.get("product") or "").strip()
                or lead.get("enquiryType")
                or "(询价未填码)"
            )
            if isinstance(engine, str):
                engine = engine.strip() or "(询价未填码)"
            self._row(country, str(engine)).add_contact(str(contact), "website_lead", enquiries=1)
        return n

    def ingest_supplier_buy_prices(self, verified_prices: list[dict[str, Any]]) -> None:
        for p in verified_prices:
            country = _normalize_country(p.get("country") or "unknown")
            codes = _engines_from_text(p.get("context", ""))
            try:
                price = float(str(p.get("price_usd", "")).replace(",", ""))
            except (TypeError, ValueError):
                continue
            for code in codes or {"(价格未识别)"}:
                self._row(country, code).buy_prices.append(price)


def _top_gaps(rows: list[DemandRow], limit: int = 5) -> list[str]:
    known = [r for r in rows if r.country not in ("unknown", "China") and len(r.contacts) > 0]
    ranked = sorted(known, key=lambda r: (-len(r.contacts), -r.enquiries, r.country, r.engine))
    if len(ranked) < limit:
        extra = sorted(
            [r for r in rows if r.country == "unknown" and len(r.contacts) > 0],
            key=lambda r: (-len(r.contacts), -r.enquiries),
        )
        ranked = ranked + extra
    lines: list[str] = []
    for i, row in enumerate(ranked[:limit], 1):
        spread = row.spread_label()
        lines.append(
            f"{i}. **{row.country}** · **{row.engine}** — {len(row.contacts)} 人找货，"
            f"{row.enquiries} 次询价，利差 {spread}"
        )
    return lines


def _format_table(rows: list[DemandRow]) -> str:
    header = "| 国家 | 发动机型号 | 找货人数 | 询价次数 | 利差/价差 | 数据来源 |"
    sep = "|------|------------|----------|----------|-----------|----------|"
    body: list[str] = []
    for row in rows:
        if len(row.contacts) == 0:
            continue
        src = " · ".join(sorted(row.sources))
        body.append(
            f"| {row.country} | {row.engine} | {len(row.contacts)} | {row.enquiries} | "
            f"{row.spread_label()} | {src} |"
        )
    if not body:
        return f"{header}\n{sep}\n| — | — | 0 | 0 | 无数据 | 无样本 |"
    return "\n".join([header, sep, *body])


def _zero_sample_countries(agg: DemandAggregator, rows: list[DemandRow]) -> list[str]:
    active = {r.country for r in rows if len(r.contacts) > 0}
    fb_countries = set()
    if FB_INTEL.is_file():
        for line in FB_INTEL.read_text(encoding="utf-8").splitlines():
            try:
                row = json.loads(line)
                c = _normalize_country(row.get("detected_country") or "")
                if c and c != "unknown":
                    fb_countries.add(c)
            except json.JSONDecodeError:
                pass
    missing = sorted(c for c in fb_countries if c not in active)
    return missing


def generate_report(*, out_path: Path | None = None) -> str:
    agg = DemandAggregator()
    wa_real = agg.ingest_whatsapp_conversations()
    wa_parsed_files = agg.ingest_whatsapp_parsed()
    fb_intel_lines = agg.ingest_fb_intel()
    fb_dm_replies = agg.ingest_fb_dm_replies()
    website_leads = agg.ingest_website_leads()

    intel = _AGG.aggregate()
    agg.ingest_supplier_buy_prices(intel.get("conversations", {}).get("verified_prices") or [])

    rows = list(agg.rows.values())
    rows.sort(key=lambda r: (r.country, -len(r.contacts), -r.enquiries, r.engine))

    today = _today_str()
    ts = _now_utc().strftime("%Y-%m-%d %H:%M UTC")
    gaps = _top_gaps([r for r in rows if len(r.contacts) > 0])
    zero_countries = _zero_sample_countries(agg, rows)

    wave_section: list[str] = []
    try:
        from customer_gateway.social_engagement_engine import wave_context

        ctx = wave_context()
        cur = ctx.get("current_wave") or {}
        nxt = ctx.get("next_wave") or {}
        cur_label = cur.get("label_ceo") or cur.get("label") or "—"
        nxt_label = nxt.get("label_ceo") or nxt.get("label") or "—"
        nxt_start = nxt.get("utc_start") or "—"
        wave_section = [
            "## 向西逐波 · 当前波次 / 下一波次",
            "",
            f"- **当前主攻**：{cur_label}（{cur.get('utc_start', '—')}–{cur.get('utc_end', '—')} UTC）",
            f"- **下一波次**：{nxt_label} · {nxt_start} UTC 起",
            f"- **今日策略**：{ctx.get('banner') or '向西逐波'}",
            "",
            "| UTC 时段 | 市场 | 重点 |",
            "|----------|------|------|",
        ]
        for row in ctx.get("timeline_rows") or []:
            mark = " **← 当前**" if row.get("is_primary") else ""
            wave_section.append(
                f"| {row.get('utc_start', '—')}–{row.get('utc_end', '—')} | "
                f"{row.get('label', '—')}{mark} | {row.get('focus', '—')} |"
            )
        wave_section.append("")
    except Exception:
        wave_section = []

    lines = [
        f"# 晨间发动机需求报告 · {today}",
        "",
        f"> 生成：{ts} · 仅验证数据，无推断",
        "",
    ]
    if wave_section:
        lines.extend(wave_section)
    lines.extend([
        "## 执行摘要（Top 5 缺口）",
        "",
    ])
    if gaps:
        lines.extend(gaps)
    else:
        lines.append("暂无足够样本 — 今晚 FB 浏览 + WhatsApp 同步后会更新。")

    lines.extend(["", "## 需求明细", "", _format_table(rows), ""])

    if zero_countries:
        lines.extend([
            "## 无样本国家",
            "",
            "以下国家在 FB 情报中出现但尚无发动机找货记录：",
            "",
            ", ".join(zero_countries),
            "",
        ])

    lines.extend([
        "---",
        "",
        "**数据源计数**：",
        f"- WhatsApp 会话（去桩）: {wa_real}",
        f"- whatsapp_parsed 文件: {wa_parsed_files}",
        f"- fb_friends_market_intel 行: {fb_intel_lines}",
        f"- fb_friend_dm_log 回复: {fb_dm_replies}",
        f"- website_leads: {website_leads}",
        f"- aggregate-market-intelligence: {intel.get('generated_at', '')}",
        "",
        f"旧版冗长报告已作废，请只读本文件：`reports/morning-engine-demand-{today}.md`",
    ])

    text = "\n".join(lines)
    target = out_path or (REPORTS_DIR / f"morning-engine-demand-{today}.md")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")
    return text


def mark_deprecated_reports() -> None:
    banner = (
        "\n\n---\n\n"
        "> ⚠️ **已作废** — CEO 要求无废话晨间报告。"
        f" 请改读 `reports/morning-engine-demand-{_today_str()}.md`（每日 UTC 08:00 更新）。\n"
    )
    for name in DEPRECATED_REPORTS:
        path = REPORTS_DIR / name
        if not path.is_file():
            continue
        content = path.read_text(encoding="utf-8")
        if "已作废" in content and "morning-engine-demand" in content:
            continue
        path.write_text(content.rstrip() + banner, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate morning engine-demand report")
    parser.add_argument("--out", help="Override output path")
    parser.add_argument("--mark-deprecated", action="store_true", help="Stamp old fluffy reports")
    parser.add_argument("--stdout", action="store_true", help="Print to stdout")
    args = parser.parse_args()

    out = Path(args.out) if args.out else None
    text = generate_report(out_path=out)
    if args.mark_deprecated:
        mark_deprecated_reports()
    if args.stdout:
        print(text)
    else:
        dest = out or (REPORTS_DIR / f"morning-engine-demand-{_today_str()}.md")
        print(f"Wrote {dest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
