"""APBD Mission Planner — correlate tool outputs into executable business missions."""

from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from agents.apbd.config import day_runtime_dir
from agents.apbd.constitution import APBD_DESTINATION, CONSTITUTION_ID, PRIMARY_KPI, SECONDARY_KPI
from agents.apbd.keyword_finder import PHASE1_COUNTRIES, PRIORITY_ENGINE_CODES, VEHICLE_ENGINE_PAIRS
from agents.apbd.safety import assert_apbd_no_browser_ui

_ANALYSIS_MODE = "traffic_first_correlate_leads_keywords_competitors"

_CSV_FIELDS = [
    "Mission Title",
    "Mission Type",
    "Traffic Source",
    "Business Reason",
    "Supporting Evidence",
    "Expected Traffic",
    "Expected Leads",
    "Expected Inquiries",
    "Estimated Difficulty",
    "Estimated Time",
    "Priority",
    "Owner",
    "Recommended Next Step",
    "Engine Code",
    "Country",
    "Impact Score",
]

_OWNER_BY_TYPE = {
    "landing_page": "Content Team",
    "engine_guide": "Content Team",
    "catalog_expansion": "APInventory",
    "outreach": "APSales",
    "content_improvement": "Content Team",
    "faq_creation": "Content Team",
    "country_expansion": "APSales + Content",
    "social_content": "Content Team",
    "forum_discovery": "Content Team",
    "backlink_opportunity": "Content Team",
    "youtube_topic": "Content Team",
    "linkedin_engagement": "APSales + Content",
    "partnership_traffic": "APSales",
}

_TRAFFIC_SOURCE_BY_TYPE = {
    "landing_page": "Google Search",
    "engine_guide": "Google Search",
    "catalog_expansion": "Google Search",
    "outreach": "WhatsApp sharing",
    "content_improvement": "Google Search",
    "faq_creation": "Google Search",
    "country_expansion": "Google Business",
    "social_content": "Facebook",
    "forum_discovery": "Industry Forums",
    "backlink_opportunity": "Backlinks",
    "youtube_topic": "YouTube",
    "linkedin_engagement": "LinkedIn",
    "partnership_traffic": "Partner Websites",
}

_DIFFICULTY_BY_TYPE = {
    "landing_page": "medium",
    "engine_guide": "medium",
    "catalog_expansion": "easy",
    "outreach": "easy",
    "content_improvement": "medium",
    "faq_creation": "easy",
    "country_expansion": "hard",
}

_TIME_BY_TYPE = {
    "landing_page": "4-8 hours",
    "engine_guide": "6-12 hours",
    "catalog_expansion": "2-4 hours",
    "outreach": "2-3 hours",
    "content_improvement": "4-6 hours",
    "faq_creation": "2-4 hours",
    "country_expansion": "1-2 weeks",
}

_CONTENT_QUEUE_CSV_FIELDS = [
    "Keyword",
    "Target Page",
    "Traffic Source",
    "Target Audience",
    "Distribution Recommendation",
    "Search Intent",
    "Buyer Intent",
    "Business Reason",
    "Expected Business Value",
    "Expected Traffic",
    "Expected Inquiry Value",
    "Priority",
    "Suggested URL",
    "Recommended Internal Links",
    "CTA",
    "Evidence",
]


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def mission_id(title: str, mission_type: str) -> str:
    blob = f"{title}|{mission_type}".lower()
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:20]


def _load_json(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def load_daily_inputs(*, day: str | None = None) -> dict[str, Any]:
    day_str = day or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    base = day_runtime_dir(day_str)
    leads = _load_json(base / "leads" / "daily-leads.json")
    keywords = _load_json(base / "keywords" / "daily-keywords.json")
    competitors = _load_json(base / "competitors" / "daily-competitors.json")
    return {
        "day": day_str,
        "leads": leads.get("leads") or [],
        "keywords": keywords.get("keywords") or [],
        "competitors": competitors.get("opportunities") or [],
        "inputs_present": {
            "leads": bool(leads),
            "keywords": bool(keywords),
            "competitors": bool(competitors),
        },
    }


def _priority_weight(priority: str) -> int:
    return {"S": 3, "A": 2, "B": 1}.get(priority, 0)


def _impact_to_traffic(score: float) -> str:
    if score >= 12:
        return "high"
    if score >= 7:
        return "medium"
    return "low"


def _impact_to_leads(score: float, lead_count: int) -> str:
    if lead_count >= 2 and score >= 10:
        return "high"
    if lead_count >= 1 or score >= 8:
        return "medium"
    return "low"


def _impact_to_inquiries(score: float) -> str:
    if score >= 12:
        return "high"
    if score >= 7:
        return "medium"
    return "low"


def _score_to_priority(score: float) -> str:
    if score >= 12:
        return "S"
    if score >= 7:
        return "A"
    return "B"


def _index_keywords(keywords: list[dict[str, Any]]) -> dict[tuple[str, str], list[dict[str, Any]]]:
    by_pair: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for kw in keywords:
        code = (kw.get("engine_code") or "").upper()
        country = kw.get("country") or ""
        if code and country:
            by_pair[(code, country)].append(kw)
        elif code:
            by_pair[(code, "")].append(kw)
    return by_pair


def _index_competitor_gaps(competitors: list[dict[str, Any]]) -> dict[str, dict[str, int]]:
    by_engine: dict[str, int] = defaultdict(int)
    by_category: dict[str, int] = defaultdict(int)
    by_country: dict[str, int] = defaultdict(int)
    for opp in competitors:
        cat = opp.get("opportunity_category") or ""
        by_category[cat] += 1
        code = (opp.get("engine_code") or "").upper()
        if code and cat == "missing_engine_page":
            by_engine[code] += 1
        missing = opp.get("missing_opportunities") or ""
        for country in PHASE1_COUNTRIES:
            if country.lower() in missing.lower():
                by_country[country] += 1
    return {"engine": dict(by_engine), "category": dict(by_category), "country": dict(by_country)}


def _index_leads(leads: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    by_country: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for lead in leads:
        country = lead.get("country") or ""
        if country:
            by_country[country].append(lead)
    return dict(by_country)


def _build_mission(
    *,
    title: str,
    mission_type: str,
    business_reason: str,
    evidence: list[str],
    score: float,
    lead_count: int = 0,
    engine_code: str = "",
    country: str = "",
    next_step: str = "",
    traffic_source: str = "",
) -> dict[str, Any]:
    priority = _score_to_priority(score)
    owner = _OWNER_BY_TYPE.get(mission_type, "CEO")
    source = traffic_source or _TRAFFIC_SOURCE_BY_TYPE.get(mission_type, "Google Search")
    return {
        "mission_title": title,
        "mission_type": mission_type,
        "traffic_source": source,
        "business_reason": business_reason,
        "supporting_evidence": evidence,
        "expected_traffic": _impact_to_traffic(score),
        "expected_leads": _impact_to_leads(score, lead_count),
        "expected_inquiries": _impact_to_inquiries(score),
        "estimated_difficulty": _DIFFICULTY_BY_TYPE.get(mission_type, "medium"),
        "estimated_time": _TIME_BY_TYPE.get(mission_type, "4-8 hours"),
        "priority": priority,
        "owner": owner,
        "recommended_next_step": next_step or f"Assign to {owner} and schedule execution this week",
        "engine_code": engine_code,
        "country": country,
        "impact_score": round(score, 1),
        "mission_id": mission_id(title, mission_type),
        "generated_at": _now_iso(),
        "analysis_mode": _ANALYSIS_MODE,
        "constitution": CONSTITUTION_ID,
        "destination": APBD_DESTINATION,
        "primary_kpi": PRIMARY_KPI,
        "secondary_kpi": SECONDARY_KPI,
    }


def generate_missions(inputs: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    assert_apbd_no_browser_ui("MissionPlanner.generate_missions")

    leads = inputs["leads"]
    keywords = inputs["keywords"]
    competitors = inputs["competitors"]
    present = inputs["inputs_present"]

    kw_index = _index_keywords(keywords)
    gap_index = _index_competitor_gaps(competitors)
    lead_index = _index_leads(leads)

    missions: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    def add_mission(mission: dict[str, Any]) -> None:
        mid = mission["mission_id"]
        if mid in seen_ids:
            return
        seen_ids.add(mid)
        missions.append(mission)

    # Landing pages: high-value keyword + competitor gap + optional leads
    scored_pairs: list[tuple[float, str, str, list[str]]] = []
    for (code, country), kws in kw_index.items():
        if not code or not country:
            continue
        s_kws = [k for k in kws if k.get("priority") == "S"]
        if not s_kws:
            continue
        score = 3.0 + len(s_kws) * 0.5
        score += min(gap_index["engine"].get(code, 0), 5) * 1.2
        country_leads = lead_index.get(country, [])
        score += sum(_priority_weight(l.get("priority", "B")) for l in country_leads)
        evidence = [
            f"{len(s_kws)} S-priority keywords for {code} in {country}",
            f"{gap_index['engine'].get(code, 0)} competitor gaps on {code}",
        ]
        if country_leads:
            evidence.append(f"{len(country_leads)} qualified leads in {country}")
        scored_pairs.append((score, code, country, evidence))

    scored_pairs.sort(key=lambda x: x[0], reverse=True)
    for score, code, country, evidence in scored_pairs[:25]:
        lead_count = len(lead_index.get(country, []))
        s_leads = sum(1 for l in lead_index.get(country, []) if l.get("priority") in {"S", "A"})
        if s_leads and gap_index["engine"].get(code, 0):
            score += 5.0  # triple signal: keyword + competitor gap + qualified buyers
        add_mission(_build_mission(
            title=f"Build {code} {country} Landing Page",
            mission_type="landing_page",
            business_reason=(
                f"Drive qualified {country} buyers to {APBD_DESTINATION} via Google Search for {code} "
                f"where competitors lack dedicated pages"
            ),
            evidence=evidence,
            score=score,
            lead_count=lead_count,
            engine_code=code,
            country=country,
            next_step=f"Draft /engines/{code.lower()}.html section for {country} buyers with CTA to WhatsApp inquiry",
        ))

    # Engine guides from vehicle-engine keyword pairs + competitor weakness
    for pair in VEHICLE_ENGINE_PAIRS[:12]:
        vehicle = pair["vehicle"]
        code = pair["engine"].upper()
        guide_kws = [
            k for k in keywords
            if (k.get("engine_code") or "").upper() == code
            and k.get("category") in {"engine_replacement", "vehicle_engine"}
            and k.get("priority") in {"S", "A"}
        ]
        if not guide_kws:
            continue
        score = 4.0 + len(guide_kws) * 0.4 + min(gap_index["engine"].get(code, 0), 3)
        evidence = [
            f"{len(guide_kws)} replacement/guide keywords for {vehicle} {code}",
            f"Competitors weak on {code} fitment content ({gap_index['engine'].get(code, 0)} gaps)",
        ]
        add_mission(_build_mission(
            title=f"Build {vehicle} Engine Guide",
            mission_type="engine_guide",
            business_reason=(
                f"Publish {vehicle} buying guide on asia-power.com to attract qualified replacement buyers via Google Search"
            ),
            evidence=evidence,
            score=score,
            engine_code=code,
            next_step=f"Create buyer guide linking {vehicle} → {code} → half-cut / gearbox options",
        ))

    # Outreach: countries with qualified leads
    for country, country_leads in lead_index.items():
        s_leads = [l for l in country_leads if l.get("priority") in {"S", "A"}]
        if not s_leads:
            continue
        score = 5.0 + len(s_leads) * 2.5
        s_kws = sum(1 for k in keywords if k.get("country") == country and k.get("priority") == "S")
        score += min(s_kws, 10) * 0.3
        if s_leads:
            score += 4.0  # ready-to-contact buyers outweigh passive search-only work
        evidence = [f"{len(s_leads)} S/A leads in {country}"]
        if s_kws:
            evidence.append(f"{s_kws} S-priority engine keywords for {country}")
        add_mission(_build_mission(
            title=f"Target {country} Engine Importers",
            mission_type="outreach",
            business_reason=f"Direct qualified importer traffic to {APBD_DESTINATION} via APSales outreach in {country}",
            evidence=evidence,
            score=score,
            lead_count=len(country_leads),
            country=country,
            next_step=f"APSales to contact top {min(3, len(s_leads))} leads with stock list + export terms",
        ))

    # Catalog expansion: engines with many competitor gaps
    top_engines = sorted(gap_index["engine"].items(), key=lambda x: x[1], reverse=True)[:8]
    for code, gap_count in top_engines:
        if gap_count < 2:
            continue
        kw_count = sum(1 for k in keywords if (k.get("engine_code") or "").upper() == code)
        score = 2.5 + gap_count * 1.2 + min(kw_count, 20) * 0.15
        evidence = [
            f"{gap_count} competitor missing-engine gaps for {code}",
            f"{kw_count} keyword opportunities reference {code}",
        ]
        add_mission(_build_mission(
            title=f"Expand {code} Engine Coverage",
            mission_type="catalog_expansion",
            business_reason=(
                f"Strengthen {code} pages on {APBD_DESTINATION} to win qualified traffic vs competitors lacking depth"
            ),
            evidence=evidence,
            score=score,
            engine_code=code,
            next_step=f"Verify {code} stock + enrich engine page with compatibility and half-cut links",
        ))

    # Content improvement from competitor categories
    category_missions = [
        ("no_half_cut_section", "Improve Half Cut Content", "content_improvement",
         "Competitors lack half-cut sections — AsiaPower half-cut catalog is a differentiation wedge"),
        ("missing_gearbox_matching", "Improve Gearbox Matching Content", "content_improvement",
         "Bundle engine + gearbox guidance increases average quote value"),
        ("weak_eeat", "Strengthen Trust Content (VIN / Stock Proof)", "content_improvement",
         "Weak competitor EEAT — AsiaPower VIN verification wins buyer trust"),
        ("poor_internal_linking", "Improve Engine ↔ Half-Cut Internal Linking", "content_improvement",
         "Better internal linking drives qualified visitors deeper into asia-power.com catalog"),
    ]
    for cat, title, mtype, reason in category_missions:
        count = gap_index["category"].get(cat, 0)
        if count < 1:
            continue
        score = 3.0 + count * 1.0
        add_mission(_build_mission(
            title=title,
            mission_type=mtype,
            business_reason=reason,
            evidence=[f"{count} competitor opportunities flagged `{cat}`"],
            score=score,
            next_step="Audit asia-power.com pages and apply content checklist from competitor gaps",
        ))

    # FAQ missions for top priority engines
    faq_engines: dict[str, int] = defaultdict(int)
    for opp in competitors:
        if opp.get("opportunity_category") == "no_faq":
            code = (opp.get("engine_code") or "").upper()
            if not code:
                match = re.search(r"\b([A-Z0-9]{2,}-[A-Z0-9]{2,})\b", opp.get("missing_opportunities") or "")
                code = match.group(1) if match else "QR25DE"
            faq_engines[code] += 1
    for code, count in sorted(faq_engines.items(), key=lambda x: x[1], reverse=True)[:5]:
        kw_count = sum(1 for k in keywords if (k.get("engine_code") or "").upper() == code)
        score = 3.5 + count + min(kw_count, 10) * 0.2
        add_mission(_build_mission(
            title=f"Create FAQ for {code}",
            mission_type="faq_creation",
            business_reason=f"Competitors lack buyer FAQ for {code}; FAQ blocks reduce friction before inquiry",
            evidence=[f"{count} competitor FAQ gaps", f"{kw_count} related keywords"],
            score=score,
            engine_code=code,
            next_step=f"Add export/import FAQ block to /engines/{code.lower()}.html",
        ))

    # Country expansion when keyword demand exists but no leads yet
    for country in PHASE1_COUNTRIES:
        if country in lead_index and lead_index[country]:
            continue
        s_kws = [k for k in keywords if k.get("country") == country and k.get("priority") == "S"]
        if len(s_kws) < 5:
            continue
        score = 4.0 + len(s_kws) * 0.3 + gap_index["country"].get(country, 0) * 0.5
        add_mission(_build_mission(
            title=f"Expand {country} Market Presence",
            mission_type="country_expansion",
            business_reason=f"Strong {country} keyword demand ({len(s_kws)} S keywords) but no leads captured yet today",
            evidence=[f"{len(s_kws)} S-priority keywords", f"{gap_index['country'].get(country, 0)} competitor country gaps"],
            score=score,
            country=country,
            next_step=f"Combine asia-power.com landing pages + APSales outreach for {country}",
        ))

    # Multi-channel traffic missions (CONSTITUTION-001 — never Google-only)
    top_engine_codes = sorted(
        {k.get("engine_code", "").upper() for k in keywords if k.get("engine_code")}
        | {c.upper() for c in PRIORITY_ENGINE_CODES[:8]},
    )[:8]

    for country in PHASE1_COUNTRIES[:5]:
        code = next(
            (k.get("engine_code", "G4KD") for k in keywords if k.get("country") == country and k.get("engine_code")),
            PRIORITY_ENGINE_CODES[0],
        )
        lead_count = len(lead_index.get(country, []))
        score = 6.0 + lead_count * 1.5 + min(
            sum(1 for k in keywords if k.get("country") == country and k.get("priority") == "S"), 10,
        ) * 0.2
        add_mission(_build_mission(
            title=f"Create Facebook content for {country} mechanics",
            mission_type="social_content",
            traffic_source="Facebook",
            business_reason=f"Facebook groups reach {country} mechanics who can drive referral traffic to {APBD_DESTINATION}",
            evidence=[f"Target {code} demand in {country}", f"{lead_count} leads in market"],
            score=score,
            lead_count=lead_count,
            engine_code=code,
            country=country,
            next_step=f"Draft Facebook post + group list for {country} {code} buyers linking to asia-power.com",
        ))

    for code in top_engine_codes[:5]:
        score = 5.5 + gap_index["engine"].get(code, 0) * 0.8
        add_mission(_build_mission(
            title=f"Find automotive forums discussing {code}",
            mission_type="forum_discovery",
            traffic_source="Industry Forums",
            business_reason=f"Forum participation can drive qualified {code} buyers to {APBD_DESTINATION}",
            evidence=[f"{gap_index['engine'].get(code, 0)} competitor gaps on {code}"],
            score=score,
            engine_code=code,
            next_step=f"Identify public forum threads about {code} import/export; prepare value reply linking asia-power.com",
        ))

    for code in top_engine_codes[:4]:
        score = 5.0 + min(sum(1 for k in keywords if (k.get("engine_code") or "").upper() == code), 15) * 0.15
        add_mission(_build_mission(
            title=f"Find YouTube topics with buyer intent for {code}",
            mission_type="youtube_topic",
            traffic_source="YouTube",
            business_reason=f"YouTube how-to and review content can funnel qualified {code} buyers to {APBD_DESTINATION}",
            evidence=[f"Buyer-intent keywords reference {code}"],
            score=score,
            engine_code=code,
            next_step=f"Research {code} YouTube topics; outline video brief linking to asia-power.com engine page",
        ))

    for country in PHASE1_COUNTRIES[:3]:
        if country not in lead_index:
            continue
        score = 5.5 + len(lead_index[country]) * 1.2
        add_mission(_build_mission(
            title=f"Discover LinkedIn discussions worth participating in — {country}",
            mission_type="linkedin_engagement",
            traffic_source="LinkedIn",
            business_reason=f"LinkedIn importer discussions can drive professional referral traffic to {APBD_DESTINATION}",
            evidence=[f"{len(lead_index[country])} leads identified in {country}"],
            score=score,
            lead_count=len(lead_index[country]),
            country=country,
            next_step=f"Find public LinkedIn posts on engine import in {country}; draft participation outline",
        ))

    if competitors or top_engine_codes:
        code = top_engine_codes[0] if top_engine_codes else "G4KD"
        add_mission(_build_mission(
            title=f"Find backlink opportunities from industry websites — {code}",
            mission_type="backlink_opportunity",
            traffic_source="Backlinks",
            business_reason=f"Industry backlinks raise qualified referral traffic to {APBD_DESTINATION} beyond Google alone",
            evidence=[f"{len(competitors)} competitor gaps analyzed", f"Anchor topic: {code}"],
            score=6.0,
            engine_code=code,
            next_step="List auto-parts industry sites/forums open to guest references; pitch asia-power.com resource",
        ))

    for country in PHASE1_COUNTRIES[:3]:
        score = 4.5 + len(lead_index.get(country, [])) * 1.0
        add_mission(_build_mission(
            title=f"Identify partnerships capable of driving traffic — {country}",
            mission_type="partnership_traffic",
            traffic_source="Partner Websites",
            business_reason=f"Partner listings and co-marketing can send qualified buyers to {APBD_DESTINATION}",
            evidence=[f"{len(lead_index.get(country, []))} potential partners/leads in {country}"],
            score=score,
            lead_count=len(lead_index.get(country, [])),
            country=country,
            next_step=f"Shortlist {country} importers/dealers for reciprocal asia-power.com listing partnership",
        ))

    missions.sort(key=lambda m: (-m["impact_score"], {"S": 0, "A": 1, "B": 2}.get(m["priority"], 3)))

    stats = {
        "ok": True,
        "analysis_mode": _ANALYSIS_MODE,
        "constitution": CONSTITUTION_ID,
        "primary_kpi": PRIMARY_KPI,
        "secondary_kpi": SECONDARY_KPI,
        "destination": APBD_DESTINATION,
        "browser_automation": False,
        "inputs_present": present,
        "leads_loaded": len(leads),
        "keywords_loaded": len(keywords),
        "competitors_loaded": len(competitors),
        "missions_generated": len(missions),
        "executive_plan_size": min(5, len(missions)),
    }
    return missions, stats


def _executive_rank(m: dict[str, Any]) -> tuple[float, float]:
    lead_boost = {"high": 3, "medium": 2, "low": 0}.get(m.get("expected_leads", ""), 0)
    inquiry_boost = {"high": 2, "medium": 1, "low": 0}.get(m.get("expected_inquiries", ""), 0)
    type_boost = {
        "outreach": 4,
        "social_content": 4,
        "forum_discovery": 3,
        "youtube_topic": 3,
        "linkedin_engagement": 3,
        "backlink_opportunity": 3,
        "partnership_traffic": 3,
        "landing_page": 2,
        "engine_guide": 2,
        "faq_creation": 1,
        "content_improvement": 1,
        "catalog_expansion": 0,
        "country_expansion": 1,
    }.get(m.get("mission_type", ""), 0)
    return (m.get("impact_score", 0) + lead_boost + inquiry_boost + type_boost, m.get("impact_score", 0))


def _select_executive_missions(missions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Top 5 across traffic channels — never a Google-only executive plan."""
    if not missions:
        return []
    ranked = sorted(missions, key=_executive_rank, reverse=True)
    by_source: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for mission in ranked:
        by_source[mission.get("traffic_source") or "Other"].append(mission)

    selected: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for _source, items in sorted(by_source.items(), key=lambda x: _executive_rank(x[1][0]), reverse=True):
        if len(selected) >= 5:
            break
        pick = items[0]
        if pick["mission_id"] in seen_ids:
            continue
        selected.append(pick)
        seen_ids.add(pick["mission_id"])

    for mission in ranked:
        if len(selected) >= 5:
            break
        if mission["mission_id"] in seen_ids:
            continue
        selected.append(mission)
        seen_ids.add(mission["mission_id"])
    return selected[:5]


def build_executive_plan(missions: list[dict[str, Any]], *, day: str) -> str:
    top5 = _select_executive_missions(missions)
    sources = sorted({m.get("traffic_source", "") for m in top5 if m.get("traffic_source")})
    lines = [
        f"# APBD Daily Executive Plan — {day}",
        "",
        f"Generated: {_now_iso()}",
        f"Constitution: {CONSTITUTION_ID} Traffic First",
        f"Destination: {APBD_DESTINATION}",
        f"Primary KPI: {PRIMARY_KPI}",
        "",
        "Top 5 missions for today (cross-channel — maximize qualified traffic to AsiaPower):",
        "",
    ]
    if sources:
        lines.append(f"Traffic channels in plan: {', '.join(sources)}")
        lines.append("")
    for i, m in enumerate(top5, 1):
        evidence = "; ".join(m.get("supporting_evidence") or [])
        lines.extend([
            f"## {i}. {m['mission_title']} [{m['priority']}]",
            "",
            f"- **Traffic source:** {m.get('traffic_source', '')}",
            f"- **Type:** {m['mission_type']}",
            f"- **Owner:** {m['owner']}",
            f"- **Why:** {m['business_reason']}",
            f"- **Evidence:** {evidence}",
            f"- **Expected impact:** traffic={m['expected_traffic']}, leads={m['expected_leads']}, inquiries={m['expected_inquiries']}",
            f"- **Effort:** {m['estimated_difficulty']} / {m['estimated_time']}",
            f"- **Next step:** {m['recommended_next_step']}",
            "",
        ])
    if not top5:
        lines.append("_No missions generated — run LeadFinder, KeywordFinder, and CompetitorFinder first._")
    return "\n".join(lines)


def save_mission_outputs(
    missions: list[dict[str, Any]],
    stats: dict[str, Any],
    *,
    day: str | None = None,
) -> dict[str, Any]:
    day_str = day or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    out_dir = day_runtime_dir(day_str) / "missions"
    out_dir.mkdir(parents=True, exist_ok=True)

    json_path = out_dir / "daily-missions.json"
    csv_path = out_dir / "daily-missions.csv"
    executive_path = out_dir / "executive-plan.md"
    summary_path = out_dir / "summary.json"

    executive_plan = build_executive_plan(missions, day=day_str)
    executive_path.write_text(executive_plan, encoding="utf-8")

    payload = {
        "generated_at": _now_iso(),
        "day": day_str,
        "tool": "MissionPlannerTool",
        "mission_count": len(missions),
        "executive_plan_missions": min(5, len(missions)),
        "stats": stats,
        "missions": missions,
        "executive_plan_path": executive_path.name,
    }
    json_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    with csv_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=_CSV_FIELDS)
        writer.writeheader()
        for row in missions:
            writer.writerow({
                "Mission Title": row.get("mission_title", ""),
                "Mission Type": row.get("mission_type", ""),
                "Traffic Source": row.get("traffic_source", ""),
                "Business Reason": row.get("business_reason", ""),
                "Supporting Evidence": "; ".join(row.get("supporting_evidence") or []),
                "Expected Traffic": row.get("expected_traffic", ""),
                "Expected Leads": row.get("expected_leads", ""),
                "Expected Inquiries": row.get("expected_inquiries", ""),
                "Estimated Difficulty": row.get("estimated_difficulty", ""),
                "Estimated Time": row.get("estimated_time", ""),
                "Priority": row.get("priority", ""),
                "Owner": row.get("owner", ""),
                "Recommended Next Step": row.get("recommended_next_step", ""),
                "Engine Code": row.get("engine_code", ""),
                "Country": row.get("country", ""),
                "Impact Score": row.get("impact_score", ""),
            })

    by_priority: dict[str, int] = {"S": 0, "A": 0, "B": 0}
    by_type: dict[str, int] = {}
    for m in missions:
        by_priority[m.get("priority", "B")] = by_priority.get(m.get("priority", "B"), 0) + 1
        mt = m.get("mission_type") or "other"
        by_type[mt] = by_type.get(mt, 0) + 1

    summary = {
        "generated_at": _now_iso(),
        "day": day_str,
        "tool": "MissionPlannerTool",
        "mission_count": len(missions),
        "executive_plan_missions": min(5, len(missions)),
        "by_priority": by_priority,
        "by_type": by_type,
        "files": {
            "json": json_path.name,
            "csv": csv_path.name,
            "executive_plan": executive_path.name,
        },
        "stats": stats,
    }
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")

    return {
        "missions_dir": str(out_dir),
        "json_path": str(json_path),
        "csv_path": str(csv_path),
        "executive_plan_path": str(executive_path),
        "summary_path": str(summary_path),
        "mission_count": len(missions),
        "summary": summary,
    }


def content_task_id(keyword: str, suggested_url: str) -> str:
    blob = f"{keyword}|{suggested_url}".lower()
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:20]


def _engine_slug(code: str) -> str:
    return code.lower().replace(" ", "-")


def _suggested_url_for_keyword(kw: dict[str, Any]) -> str:
    page_type = kw.get("suggested_page_type") or "engine_detail"
    code = (kw.get("engine_code") or "").strip()
    if page_type == "half_cut_listing":
        return "/half-cuts/"
    if page_type == "gearbox_hub":
        return "/gearboxes/"
    if page_type == "contact_enquiry":
        return "/contact.html"
    if code:
        return f"/engines/{_engine_slug(code)}.html"
    return "/engines/"


def _internal_links_for_keyword(kw: dict[str, Any]) -> str:
    code = (kw.get("engine_code") or "").strip()
    links = ["/half-cuts/", "/gearboxes/", "/contact.html"]
    if code:
        links.insert(0, f"/engines/{_engine_slug(code)}.html")
    country = kw.get("country") or ""
    if country:
        links.append(f"/engines/ ({country} buyer section)")
    return "; ".join(links[:4])


def _cta_for_keyword(kw: dict[str, Any]) -> str:
    code = kw.get("engine_code") or "engine"
    return f"WhatsApp inquiry — verify {code} stock, VIN fitment and export quote"


def _target_audience(*, country: str = "", code: str = "") -> str:
    parts = []
    if country:
        parts.append(f"{country} engine importers")
    parts.append("mechanics and fleet buyers")
    if code:
        parts.append(f"seeking {code}")
    return ", ".join(parts)


def _distribution_recommendation(traffic_source: str, *, country: str = "", code: str = "") -> str:
    slug = _engine_slug(code) if code else ""
    url = f"{APBD_DESTINATION}/engines/{slug}.html" if slug else APBD_DESTINATION
    recommendations = {
        "Google Search": f"Publish on asia-power.com; optimize page {url}; share link in WhatsApp status",
        "Google Images": f"Add verified engine photos on {url}; image alt tags for {code or 'engine'}",
        "Facebook": f"Draft post for {country or 'target'} auto parts/mechanic Facebook groups linking to {url}",
        "YouTube": f"Video brief on {code or 'engine'} import; description links to {url}",
        "LinkedIn": f"Comment on {country or 'regional'} importer posts with link to {url}",
        "Industry Forums": f"Participate in public {code or 'engine'} forum threads; signature/link to {url}",
        "Backlinks": f"Pitch guest reference or resource link to industry site pointing to {url}",
        "Partner Websites": f"Reciprocal listing with {country or 'regional'} partner linking to {url}",
        "WhatsApp sharing": f"Share stock list + {url} to qualified {country or 'buyer'} contacts",
    }
    return recommendations.get(traffic_source, f"Drive qualified visitors to {url}")


def _content_task_base(
    *,
    keyword: str,
    target_page: str,
    traffic_source: str,
    business_reason: str,
    priority: str,
    suggested_url: str,
    evidence: str,
    engine_code: str = "",
    country: str = "",
    search_intent: str = "commercial",
    buyer_intent: str = "medium",
) -> dict[str, Any]:
    expected_traffic = "high" if priority == "S" else "medium" if priority == "A" else "low"
    inquiry_value = buyer_intent if buyer_intent in {"high", "medium", "low"} else "medium"
    return {
        "keyword": keyword,
        "target_page": target_page,
        "traffic_source": traffic_source,
        "target_audience": _target_audience(country=country, code=engine_code),
        "distribution_recommendation": _distribution_recommendation(
            traffic_source, country=country, code=engine_code,
        ),
        "search_intent": search_intent,
        "buyer_intent": buyer_intent,
        "business_reason": business_reason,
        "expected_business_value": business_reason,
        "expected_traffic": expected_traffic,
        "expected_inquiry_value": inquiry_value,
        "priority": priority,
        "suggested_url": suggested_url,
        "recommended_internal_links": _internal_links_for_keyword({"engine_code": engine_code, "country": country}),
        "cta": _cta_for_keyword({"engine_code": engine_code or "engine"}),
        "evidence": evidence,
        "engine_code": engine_code,
        "country": country,
        "destination": APBD_DESTINATION,
        "task_id": content_task_id(keyword, suggested_url),
        "generated_at": _now_iso(),
        "source": "mission_planner_content_queue",
        "constitution": CONSTITUTION_ID,
    }


def generate_content_queue(
    *,
    missions: list[dict[str, Any]],
    keywords: list[dict[str, Any]],
    competitors: list[dict[str, Any]],
    max_tasks: int = 60,
) -> list[dict[str, Any]]:
    assert_apbd_no_browser_ui("MissionPlanner.generate_content_queue")

    tasks: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add_task(task: dict[str, Any]) -> None:
        tid = task["task_id"]
        if tid in seen or len(tasks) >= max_tasks:
            return
        seen.add(tid)
        tasks.append(task)

    for kw in keywords:
        if kw.get("priority") not in {"S", "A"}:
            continue
        keyword = kw.get("keyword") or ""
        if not keyword:
            continue
        url = _suggested_url_for_keyword(kw)
        evidence_parts = [kw.get("reason") or kw.get("business_value") or ""]
        for mission in missions[:10]:
            if mission.get("engine_code") and mission["engine_code"].upper() == (kw.get("engine_code") or "").upper():
                evidence_parts.append(mission.get("mission_title", ""))
                break
        add_task(_content_task_base(
            keyword=keyword,
            target_page=kw.get("suggested_page_type") or "engine_detail",
            traffic_source="Google Search",
            business_reason=kw.get("business_value") or f"Drive qualified search traffic to asia-power.com: {keyword}",
            priority=kw.get("priority") or "B",
            suggested_url=url,
            evidence="; ".join(p for p in evidence_parts if p),
            engine_code=kw.get("engine_code") or "",
            country=kw.get("country") or "",
            search_intent=kw.get("search_intent") or "commercial",
            buyer_intent=kw.get("buyer_intent") or "medium",
        ))

    channel_missions = [
        m for m in missions
        if m.get("mission_type") in {
            "social_content", "forum_discovery", "youtube_topic", "linkedin_engagement",
            "backlink_opportunity", "partnership_traffic", "outreach",
        }
        and m.get("priority") in {"S", "A", "B"}
    ]
    for mission in channel_missions[:20]:
        code = mission.get("engine_code") or ""
        country = mission.get("country") or ""
        keyword = mission.get("mission_title", "")
        url = f"/engines/{_engine_slug(code)}.html" if code else "/engines/"
        add_task(_content_task_base(
            keyword=keyword,
            target_page=mission.get("mission_type") or "distribution",
            traffic_source=mission.get("traffic_source") or "Facebook",
            business_reason=mission.get("business_reason") or "",
            priority=mission.get("priority") or "A",
            suggested_url=url,
            evidence="; ".join(mission.get("supporting_evidence") or []),
            engine_code=code,
            country=country,
            search_intent="commercial",
            buyer_intent=mission.get("expected_inquiries") or "medium",
        ))

    content_missions = [
        m for m in missions
        if m.get("mission_type") in {"landing_page", "engine_guide", "faq_creation", "content_improvement"}
        and m.get("priority") in {"S", "A"}
    ]
    for mission in content_missions[:15]:
        code = mission.get("engine_code") or ""
        country = mission.get("country") or ""
        keyword = f"{code} {country}".strip() or mission.get("mission_title", "")
        url = f"/engines/{_engine_slug(code)}.html" if code else "/engines/"
        add_task(_content_task_base(
            keyword=keyword,
            target_page=mission.get("mission_type") or "engine_detail",
            traffic_source=mission.get("traffic_source") or "Google Search",
            business_reason=mission.get("business_reason") or "",
            priority=mission.get("priority") or "A",
            suggested_url=url,
            evidence="; ".join(mission.get("supporting_evidence") or []),
            engine_code=code,
            country=country,
        ))

    if competitors:
        gap = competitors[0]
        code = gap.get("engine_code") or "G4KD"
        keyword = f"{code} engine for sale"
        url = f"/engines/{_engine_slug(code)}.html"
        add_task(_content_task_base(
            keyword=keyword,
            target_page="engine_detail",
            traffic_source="Google Search",
            business_reason=gap.get("business_opportunity") or f"Competitor gap on {code} — drive traffic to asia-power.com",
            priority=gap.get("priority") or "S",
            suggested_url=url,
            evidence=gap.get("missing_opportunities") or "",
            engine_code=code,
            search_intent="transactional",
            buyer_intent="high",
        ))

    tasks.sort(key=lambda t: ({"S": 0, "A": 1, "B": 2}.get(t["priority"], 3), t["keyword"]))
    return tasks


def save_content_queue(
    tasks: list[dict[str, Any]],
    *,
    day: str | None = None,
) -> dict[str, Any]:
    day_str = day or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    out_dir = day_runtime_dir(day_str) / "content_queue"
    out_dir.mkdir(parents=True, exist_ok=True)

    json_path = out_dir / "content-queue.json"
    csv_path = out_dir / "content-queue.csv"
    summary_path = out_dir / "summary.json"

    payload = {
        "generated_at": _now_iso(),
        "day": day_str,
        "tool": "MissionPlannerTool",
        "task_count": len(tasks),
        "tasks": tasks,
    }
    json_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    with csv_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=_CONTENT_QUEUE_CSV_FIELDS)
        writer.writeheader()
        for row in tasks:
            writer.writerow({
                "Keyword": row.get("keyword", ""),
                "Target Page": row.get("target_page", ""),
                "Traffic Source": row.get("traffic_source", ""),
                "Target Audience": row.get("target_audience", ""),
                "Distribution Recommendation": row.get("distribution_recommendation", ""),
                "Search Intent": row.get("search_intent", ""),
                "Buyer Intent": row.get("buyer_intent", ""),
                "Business Reason": row.get("business_reason", ""),
                "Expected Business Value": row.get("expected_business_value", ""),
                "Expected Traffic": row.get("expected_traffic", ""),
                "Expected Inquiry Value": row.get("expected_inquiry_value", ""),
                "Priority": row.get("priority", ""),
                "Suggested URL": row.get("suggested_url", ""),
                "Recommended Internal Links": row.get("recommended_internal_links", ""),
                "CTA": row.get("cta", ""),
                "Evidence": row.get("evidence", ""),
            })

    by_priority: dict[str, int] = {"S": 0, "A": 0, "B": 0}
    for task in tasks:
        by_priority[task.get("priority", "B")] = by_priority.get(task.get("priority", "B"), 0) + 1

    summary = {
        "generated_at": _now_iso(),
        "day": day_str,
        "tool": "MissionPlannerTool",
        "task_count": len(tasks),
        "by_priority": by_priority,
        "files": {"json": json_path.name, "csv": csv_path.name},
    }
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")

    return {
        "content_queue_dir": str(out_dir),
        "json_path": str(json_path),
        "csv_path": str(csv_path),
        "summary_path": str(summary_path),
        "task_count": len(tasks),
        "summary": summary,
    }


def run_mission_planner(*, day: str | None = None) -> dict[str, Any]:
    inputs = load_daily_inputs(day=day)
    if not any(inputs["inputs_present"].values()):
        return {
            "ok": False,
            "status": "failed",
            "error": "No tool outputs found for today — run leadfinder, keywordfinder, competitorfinder first",
            "inputs_present": inputs["inputs_present"],
        }
    missions, stats = generate_missions(inputs)
    outputs = save_mission_outputs(missions, stats, day=inputs["day"])
    content_tasks = generate_content_queue(
        missions=missions,
        keywords=inputs["keywords"],
        competitors=inputs["competitors"],
    )
    content_outputs = save_content_queue(content_tasks, day=inputs["day"])
    stats["content_queue_tasks"] = content_outputs["task_count"]

    from agents.apbd.draft_assets import generate_draft_assets, save_draft_assets

    draft_assets = generate_draft_assets(missions)
    asset_outputs = save_draft_assets(draft_assets, day=inputs["day"])
    stats["draft_asset_count"] = asset_outputs["asset_count"]
    stats["pending_approval"] = asset_outputs["pending_approval"]

    return {
        "ok": True,
        "status": "completed",
        "mission_count": outputs["mission_count"],
        "content_queue_count": content_outputs["task_count"],
        "draft_asset_count": asset_outputs["asset_count"],
        "pending_approval": asset_outputs["pending_approval"],
        "outputs": outputs,
        "content_queue": content_outputs,
        "draft_assets": asset_outputs,
        "stats": stats,
    }
