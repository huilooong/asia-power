"""CRM tool — customer memory and sales pipeline for APSales."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path

from tools import memory_tool

ROOT = Path(__file__).resolve().parent.parent
PIPELINE_FILE = ROOT / "memory" / "projects" / "sales_pipeline.md"
CUSTOMERS_DIR = ROOT / "memory" / "customers"

PIPELINE_STAGES = ("Lead", "Qualified", "Quoted", "Negotiating", "Won", "Lost")


def _timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _slug(name: str) -> str:
    slug = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "-", (name or "").lower()).strip("-")
    return slug[:48] or "customer"


def ensure_pipeline() -> None:
    PIPELINE_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not PIPELINE_FILE.is_file():
        PIPELINE_FILE.write_text(
            "# Sales Pipeline\n\n"
            "| Customer | Stage | Country | Language | Potential | Last Contact |\n"
            "|----------|-------|---------|----------|-----------|--------------|\n",
            encoding="utf-8",
        )


def get_pipeline() -> str:
    ensure_pipeline()
    return PIPELINE_FILE.read_text(encoding="utf-8").strip()


def format_pipeline_summary() -> str:
    text = get_pipeline()
    lines = [ln for ln in text.splitlines() if ln.startswith("|") and "---" not in ln]
    data_rows = [ln for ln in lines if not ln.startswith("| Customer")]
    return f"Sales pipeline — {len(data_rows)} active row(s)\n\n{text}"


def update_pipeline_stage(
    customer: str,
    stage: str,
    *,
    country: str = "",
    language: str = "en",
    potential: str = "medium",
) -> str:
    """Add or update a customer row in sales_pipeline.md."""
    ensure_pipeline()
    stage = stage.strip().title()
    if stage not in PIPELINE_STAGES:
        stage = "Lead"

    name = customer.strip()
    ts = _timestamp().split()[0]
    row = f"| {name} | {stage} | {country} | {language} | {potential} | {ts} |"

    text = PIPELINE_FILE.read_text(encoding="utf-8")
    pattern = re.compile(
        rf"^\|\s*{re.escape(name)}\s*\|.*$",
        re.MULTILINE | re.IGNORECASE,
    )
    if pattern.search(text):
        text = pattern.sub(row, text)
    else:
        if not text.endswith("\n"):
            text += "\n"
        text += row + "\n"

    PIPELINE_FILE.write_text(text, encoding="utf-8")
    memory_tool._index_add(
        "project",
        "projects/sales_pipeline.md",
        f"Pipeline: {name}",
        tags=["pipeline", stage.lower()],
        keywords=[_slug(name)],
        source="apsales",
    )
    return f"Pipeline updated: {name} → {stage}"


def save_customer_record(
    customer: str,
    *,
    country: str = "",
    language: str = "en",
    detected_language: str | None = None,
    communication_language: str | None = None,
    preferred_language: str | None = None,
    interested_products: str = "",
    conversation_summary: str = "",
    follow_up_status: str = "open",
    potential_level: str = "medium",
    source: str = "apsales",
    buyer_or_supplier: str = "buyer",
    demand_type: str = "",
    matched_inventory_status: str = "unchecked",
    platform_value: str = "",
) -> str:
    """Structured customer record in memory/customers/{slug}.md."""
    CUSTOMERS_DIR.mkdir(parents=True, exist_ok=True)
    name = customer.strip()
    slug = _slug(name)
    path = CUSTOMERS_DIR / f"{slug}.md"
    rel = f"customers/{slug}.md"

    comm_lang = communication_language or language
    detected = detected_language or comm_lang
    preferred = preferred_language or comm_lang

    block = (
        f"\n## {_timestamp()}\n"
        f"- **Customer:** {name}\n"
        f"- **Buyer or Supplier:** {buyer_or_supplier}\n"
        f"- **Country:** {country}\n"
        f"- **Detected Language:** {detected}\n"
        f"- **Communication Language:** {comm_lang}\n"
        f"- **Preferred Language:** {preferred}\n"
        f"- **Language:** {comm_lang}\n"
        f"- **Demand Type:** {demand_type or 'general'}\n"
        f"- **Interested Products:** {interested_products}\n"
        f"- **Matched Inventory Status:** {matched_inventory_status}\n"
        f"- **Platform Value:** {platform_value or 'gmv_opportunity'}\n"
        f"- **Conversation Summary:** {conversation_summary[:800]}\n"
        f"- **Follow-up Status:** {follow_up_status}\n"
        f"- **Last Contact:** {_timestamp()}\n"
        f"- **Potential Level:** {potential_level}\n"
        f"- **Source:** {source}\n"
    )

    if not path.exists():
        path.write_text(f"# Customer: {name}\n\n", encoding="utf-8")
    with path.open("a", encoding="utf-8") as f:
        f.write(block)

    memory_tool._index_add(
        "customer",
        rel,
        name,
        tags=["customer", follow_up_status],
        keywords=[slug, country.lower()] if country else [slug],
        source=source,
    )
    update_pipeline_stage(
        name,
        "Lead" if follow_up_status == "open" else "Qualified",
        country=country,
        language=comm_lang,
        potential=potential_level,
    )
    return f"Customer record saved: {name}"


def list_customers(limit: int = 20) -> list[str]:
    CUSTOMERS_DIR.mkdir(parents=True, exist_ok=True)
    names: list[str] = []
    for path in sorted(CUSTOMERS_DIR.glob("*.md")):
        text = path.read_text(encoding="utf-8")
        m = re.search(r"^# Customer:\s*(.+)$", text, re.MULTILINE)
        names.append(m.group(1).strip() if m else path.stem)
        if len(names) >= limit:
            break
    return names


def format_customer_list() -> str:
    customers = list_customers()
    if not customers:
        return "No customer records yet. Use /customer <name> | country | language | products | summary"
    lines = ["Customers:"]
    for c in customers:
        lines.append(f"  - {c}")
    return "\n".join(lines)


def get_customer_summary(customer: str) -> str:
    slug = _slug(customer)
    path = CUSTOMERS_DIR / f"{slug}.md"
    if not path.is_file():
        return f"No record for customer: {customer}"
    return path.read_text(encoding="utf-8").strip()[-2000:]
