"""CLI for `/apbd leads …` commands."""

from __future__ import annotations

import json
from typing import Any


def _parse_flags(parts: list[str]) -> dict[str, str]:
    flags: dict[str, str] = {}
    i = 0
    while i < len(parts):
        tok = parts[i]
        if tok.startswith("--") and i + 1 < len(parts) and not parts[i + 1].startswith("--"):
            flags[tok[2:].replace("-", "_")] = parts[i + 1]
            i += 2
            continue
        if tok.startswith("--") and "=" in tok:
            k, v = tok[2:].split("=", 1)
            flags[k.replace("-", "_")] = v
            i += 1
            continue
        if tok.startswith("--"):
            flags[tok[2:].replace("-", "_")] = "1"
            i += 1
            continue
        i += 1
    return flags


def run_leads_cli(message: str) -> str:
    """
    Supported:
      /apbd leads discover --country CA --city Richmond --limit 20
      /apbd leads enrich --country CA --limit 50
      /apbd leads score --country CA
      /apbd leads review --country CA
      /apbd leads approve --id lead-xxx
      /apbd leads reject --id lead-xxx --reason duplicate
      /apbd leads export --country CA --format csv
      /apbd leads query --status approved_for_outreach --limit 20
      /apbd leads coverage --country CA
      /apbd leads refresh --country CA --limit 40
      /apbd leads batch --country CA --limit 40
      /apbd leads fixture-load
    """
    parts = (message or "").strip().split()
    # Expect: /apbd leads <action> ...
    if len(parts) < 3:
        return _help()
    action = parts[2].lower()
    flags = _parse_flags(parts[3:])

    country = flags.get("country", "CA")
    city = flags.get("city", "")
    region = flags.get("region", "")
    limit = int(flags.get("limit") or 20)
    dry_run = flags.get("dry_run") == "1"

    try:
        if action == "discover":
            from agents.apbd.leads.pipeline import run_discover

            result = run_discover(
                country=country, city=city, region_id=region, limit=limit, dry_run=dry_run
            )
            return _fmt(result)

        if action == "enrich":
            from agents.apbd.leads.pipeline import run_enrich

            return _fmt(run_enrich(country=country, city=city, limit=limit))

        if action == "score":
            from agents.apbd.leads.pipeline import run_score

            return _fmt(run_score(country=country, limit=int(flags.get("limit") or 0)))

        if action == "review":
            from agents.apbd.leads.pipeline import run_review_enqueue

            return _fmt(
                run_review_enqueue(
                    country=country,
                    min_score=float(flags.get("min_score") or 55),
                    limit=limit,
                )
            )

        if action == "approve":
            from agents.apbd.leads.review_queue import approve_for_outreach

            cid = flags.get("id") or flags.get("company_id") or ""
            if not cid:
                return "Missing --id <company_id>"
            return _fmt(approve_for_outreach(cid, reviewer=flags.get("reviewer") or "ceo"))

        if action == "reject":
            from agents.apbd.leads.review_queue import reject_company

            cid = flags.get("id") or flags.get("company_id") or ""
            if not cid:
                return "Missing --id <company_id>"
            return _fmt(reject_company(cid, reason=flags.get("reason") or "", reviewer=flags.get("reviewer") or "ceo"))

        if action == "export":
            from agents.apbd.leads.export import export_leads

            return _fmt(
                export_leads(
                    country=country,
                    status=flags.get("status") or "",
                    priority=flags.get("priority") or "",
                    fmt=flags.get("format") or "csv",
                )
            )

        if action == "query":
            from agents.apbd.leads.query import query_leads

            rows = query_leads(
                country=country,
                city=city,
                status=flags.get("status") or "",
                priority=flags.get("priority") or "",
                chinese=flags.get("chinese") or "",
                min_score=float(flags["min_score"]) if flags.get("min_score") else None,
                limit=limit,
            )
            slim = [
                {
                    "id": r.get("id"),
                    "name": r.get("display_name"),
                    "city": (r.get("location") or {}).get("city"),
                    "score": r.get("score"),
                    "priority": r.get("priority"),
                    "status": r.get("status"),
                    "chinese": (r.get("chinese_relevance") or {}).get("status"),
                }
                for r in rows
            ]
            return _fmt({"ok": True, "count": len(slim), "rows": slim})

        if action == "coverage":
            from agents.apbd.leads.refresh import coverage_report

            return _fmt(coverage_report(country=country))

        if action == "refresh":
            from agents.apbd.leads.refresh import refresh_stale

            return _fmt(refresh_stale(country=country, limit=limit))

        if action == "batch":
            return _fmt(_run_batch(country=country, limit=limit, city=city, region=region))

        if action in ("fixture-load", "fixture_load", "fixtures"):
            return _fmt(_load_fixtures())

        if action == "help":
            return _help()

    except Exception as exc:
        return f"APBD leads error: {exc}"

    return _help()


def _run_batch(*, country: str, limit: int, city: str, region: str) -> dict[str, Any]:
    from agents.apbd.leads.pipeline import run_discover, run_enrich, run_score
    from agents.apbd.leads.refresh import coverage_report

    discover = run_discover(country=country, city=city, region_id=region, limit=limit)
    enrich = run_enrich(country=country, city=city, limit=limit) if discover.get("ok") or discover.get("added") else {"ok": False, "skipped": True}
    score = run_score(country=country)
    report = coverage_report(country=country)
    return {
        "ok": True,
        "discover": discover,
        "enrich": enrich,
        "score": score,
        "coverage": {
            "valid_total": report.get("valid_total"),
            "gap_to_target": report.get("gap_to_target"),
            "path": report.get("path"),
            "coverage": report.get("coverage"),
        },
    }


def _load_fixtures() -> dict[str, Any]:
    from pathlib import Path

    from agents.apbd.leads.pipeline import ingest_fixture_companies

    path = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "apbd_leads" / "canada_sample.json"
    if not path.is_file():
        return {"ok": False, "error": f"fixture_missing:{path}"}
    data = json.loads(path.read_text(encoding="utf-8"))
    companies = data.get("companies") if isinstance(data, dict) else data
    return ingest_fixture_companies(list(companies or []))


def _fmt(result: dict[str, Any]) -> str:
    return json.dumps(result, ensure_ascii=False, indent=2)


def _help() -> str:
    return (
        "APBD leads commands:\n"
        "  /apbd leads discover --country CA --city Richmond --limit 20\n"
        "  /apbd leads discover --country CA --city Richmond --dry-run\n"
        "  /apbd leads enrich --country CA --limit 50\n"
        "  /apbd leads score --country CA\n"
        "  /apbd leads review --country CA\n"
        "  /apbd leads approve --id lead-xxx\n"
        "  /apbd leads reject --id lead-xxx --reason duplicate\n"
        "  /apbd leads export --country CA --format csv\n"
        "  /apbd leads query --status approved_for_outreach --limit 20\n"
        "  /apbd leads coverage --country CA\n"
        "  /apbd leads refresh --country CA --limit 40\n"
        "  /apbd leads batch --country CA --limit 40\n"
        "  /apbd leads fixture-load\n"
        "\n"
        "Missing Places key → explicit error (no Maps HTML scrape).\n"
        "Sales: /outreach scan includes approved_for_outreach (source=apbd_leads)."
    )
