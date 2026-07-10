"""APBD Draft Assets — Mission → ready-to-use business drafts (approval required)."""

from __future__ import annotations

import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from agents.apbd.config import day_runtime_dir
from agents.apbd.constitution import APBD_DESTINATION, CONSTITUTION_ID
from agents.apbd.safety import assert_apbd_no_browser_ui

_APPROVAL_STATUS = "pending"

_CATEGORY_BY_MISSION_TYPE: dict[str, str] = {
    "landing_page": "landing_pages",
    "engine_guide": "landing_pages",
    "catalog_expansion": "landing_pages",
    "content_improvement": "landing_pages",
    "faq_creation": "landing_pages",
    "country_expansion": "landing_pages",
    "social_content": "social",
    "youtube_topic": "youtube",
    "linkedin_engagement": "linkedin",
    "forum_discovery": "forums",
    "backlink_opportunity": "backlinks",
    "partnership_traffic": "backlinks",
    "outreach": "emails",
}

_CSV_FIELDS = [
    "Asset ID",
    "Mission ID",
    "Mission Title",
    "Asset Type",
    "Traffic Source",
    "Target Audience",
    "Business Goal",
    "Recommended CTA",
    "Recommended Destination URL",
    "Approval Status",
    "Generated Time",
    "Category",
]


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def asset_id(mission_id: str, asset_type: str) -> str:
    blob = f"{mission_id}|{asset_type}".lower()
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:20]


def _engine_slug(code: str) -> str:
    return code.lower().replace(" ", "-")


def _destination_path(code: str = "", *, suffix: str = "") -> str:
    if code:
        return f"/engines/{_engine_slug(code)}.html{suffix}"
    return "/engines/"


def _full_url(path: str) -> str:
    base = APBD_DESTINATION.rstrip("/")
    if path.startswith("http"):
        return path
    return f"{base}{path if path.startswith('/') else '/' + path}"


def _cta(code: str = "engine", country: str = "") -> str:
    geo = f" ({country})" if country else ""
    return f"WhatsApp inquiry{geo} — verify {code or 'engine'} stock, VIN fitment and export quote"


def _asset_shell(
    mission: dict[str, Any],
    *,
    asset_type: str,
    draft_content: dict[str, Any],
    category: str,
    target_audience: str = "",
    recommended_cta: str = "",
    destination_path: str = "/engines/",
) -> dict[str, Any]:
    mid = mission.get("mission_id") or ""
    atype = asset_type
    return {
        "asset_id": asset_id(mid, atype),
        "mission_id": mid,
        "mission_title": mission.get("mission_title", ""),
        "mission_type": mission.get("mission_type", ""),
        "asset_type": atype,
        "traffic_source": mission.get("traffic_source") or "",
        "target_audience": target_audience or f"{mission.get('country', 'Global')} engine importers and mechanics",
        "business_goal": mission.get("business_reason") or mission.get("primary_kpi", ""),
        "draft_content": draft_content,
        "recommended_cta": recommended_cta or _cta(mission.get("engine_code", ""), mission.get("country", "")),
        "recommended_destination_url": _full_url(destination_path),
        "approval_status": _APPROVAL_STATUS,
        "generated_at": _now_iso(),
        "category": category,
        "constitution": CONSTITUTION_ID,
        "upgrade": "UPGRADE-001",
    }


def _landing_page_assets(mission: dict[str, Any]) -> list[dict[str, Any]]:
    code = mission.get("engine_code") or "G4KD"
    country = mission.get("country") or "Ghana"
    path = _destination_path(code, suffix=f"#buyers-{country.lower().replace(' ', '-')}")
    draft = {
        "landing_page_brief": (
            f"Localized {code} section for {country} buyers on asia-power.com. "
            f"Highlight verified stock, VIN decode, export terms, and WhatsApp inquiry."
        ),
        "seo_outline": [
            f"H1: {code} Engine Export to {country}",
            f"H2: Why importers choose AsiaPower for {code}",
            f"H2: {code} compatibility and fitment",
            f"H2: Export process to {country}",
            f"H2: FAQ",
        ],
        "suggested_url": path,
        "schema_outline": {
            "@type": "Product",
            "name": f"{code} Used Engine",
            "brand": "AsiaPower",
            "areaServed": country,
            "url": _full_url(path),
        },
        "faq_draft": [
            {"q": f"Do you have {code} in stock?", "a": "Stock confirmed on inquiry with VIN where applicable."},
            {"q": f"Can you ship {code} to {country}?", "a": "Yes — export terms provided on WhatsApp inquiry."},
            {"q": "How do I verify engine compatibility?", "a": "Provide VIN; we confirm fitment before quote."},
        ],
        "internal_link_plan": [
            _destination_path(code),
            "/half-cuts/",
            "/gearboxes/",
            "/contact.html",
        ],
    }
    return [_asset_shell(
        mission,
        asset_type="landing_page_pack",
        draft_content=draft,
        category="landing_pages",
        target_audience=f"{country} engine importers and mechanics seeking {code}",
        destination_path=path,
    )]


def _engine_guide_assets(mission: dict[str, Any]) -> list[dict[str, Any]]:
    code = mission.get("engine_code") or "2TR-FE"
    title = mission.get("mission_title", f"Engine Guide — {code}")
    path = _destination_path(code)
    draft = {
        "guide_title": title,
        "seo_outline": [
            f"H1: {title}",
            "H2: Common applications and fitment",
            "H2: Half-cut vs long block options",
            "H2: Export checklist",
            "H2: FAQ",
        ],
        "suggested_url": path,
        "faq_draft": [
            {"q": "Is this engine suitable for my vehicle?", "a": "Send VIN for fitment confirmation."},
        ],
        "internal_link_plan": [path, "/half-cuts/", "/contact.html"],
    }
    return [_asset_shell(mission, asset_type="engine_guide_pack", draft_content=draft, category="landing_pages", destination_path=path)]


def _facebook_assets(mission: dict[str, Any]) -> list[dict[str, Any]]:
    code = mission.get("engine_code") or "G4KD"
    country = mission.get("country") or "Ghana"
    path = _destination_path(code)
    draft = {
        "facebook_post": (
            f"🔧 {country} mechanics & importers — verified {code} engines available for export.\n"
            f"VIN check ✓ Stock confirmation ✓ Shipping to {country}\n"
            f"Details: {_full_url(path)}\n"
            f"WhatsApp us for today's stock list."
        ),
        "image_prompt": (
            f"Professional photo of {code} engine on pallet, AsiaPower branding, "
            f"clean workshop, export-ready, {country} market context"
        ),
        "hashtags": [f"#{code.replace('-', '')}", "#UsedEngine", "#AutoParts", f"#{country.replace(' ', '')}", "#AsiaPower"],
        "publishing_recommendation": f"Post in {country} auto parts / mechanic Facebook groups — CEO approval before publish",
    }
    return [_asset_shell(
        mission,
        asset_type="facebook_post_pack",
        draft_content=draft,
        category="social",
        target_audience=f"{country} mechanics and parts traders",
        destination_path=path,
    )]


def _linkedin_assets(mission: dict[str, Any]) -> list[dict[str, Any]]:
    country = mission.get("country") or "West Africa"
    code = mission.get("engine_code") or "G4KD"
    path = _destination_path(code)
    title = f"How {country} Importers Source Verified {code} Engines from China"
    draft = {
        "linkedin_article_title": title,
        "linkedin_article": (
            f"Importers in {country} increasingly need verified {code} supply with transparent export terms.\n\n"
            f"AsiaPower connects buyers to verified supplier inventory with VIN confirmation and documented export process.\n\n"
            f"Learn more: {_full_url(path)}"
        ),
        "cta": _cta(code, country),
        "publishing_recommendation": "Publish as LinkedIn article or long post — CEO approval before publish",
    }
    return [_asset_shell(mission, asset_type="linkedin_article_pack", draft_content=draft, category="linkedin", destination_path=path)]


def _youtube_assets(mission: dict[str, Any]) -> list[dict[str, Any]]:
    code = mission.get("engine_code") or "G4KD"
    path = _destination_path(code)
    title = f"{code} Engine Export Guide — What Importers Should Ask Before Buying"
    draft = {
        "video_title": title,
        "video_script": (
            f"[INTRO] Buying a {code} engine for export? Here are 5 questions every importer should ask.\n"
            f"[1] Is stock confirmed with photos and VIN?\n"
            f"[2] What is included — long block, half cut, accessories?\n"
            f"[3] Export terms to your country?\n"
            f"[4] Compatibility verification process?\n"
            f"[OUTRO] Link in description: {_full_url(path)} — WhatsApp for stock list."
        ),
        "thumbnail_idea": f"Bold text '{code} EXPORT GUIDE' + engine photo + AsiaPower logo",
        "description": f"Verified {code} export guide. Stock inquiry: {_full_url(path)}",
        "tags": [code, "used engine", "engine export", "AsiaPower", "auto parts"],
        "cta": _cta(code),
        "publishing_recommendation": "CEO approval before upload — no auto-publish",
    }
    return [_asset_shell(mission, asset_type="youtube_video_pack", draft_content=draft, category="youtube", destination_path=path)]


def _forum_assets(mission: dict[str, Any]) -> list[dict[str, Any]]:
    code = mission.get("engine_code") or "QR25DE"
    path = _destination_path(code)
    draft = {
        "suggested_forums": [
            "Toyota/Nissan owner forums (public threads on engine replacement)",
            "Africa auto importer communities (public)",
            "Reddit r/MechanicAdvice or regional auto subreddits",
        ],
        "reply_draft": (
            f"We supply verified {code} engines with VIN confirmation and export documentation. "
            f"Happy to help with fitment questions — see our engine guide at {_full_url(path)} "
            f"or WhatsApp for stock."
        ),
        "reference_links": [_full_url(path), _full_url("/half-cuts/"), _full_url("/contact.html")],
        "cta": _cta(code),
        "publishing_recommendation": "Manual forum participation only — CEO approval before any post",
    }
    return [_asset_shell(mission, asset_type="forum_reply_pack", draft_content=draft, category="forums", destination_path=path)]


def _backlink_assets(mission: dict[str, Any]) -> list[dict[str, Any]]:
    code = mission.get("engine_code") or "G4KD"
    path = _destination_path(code)
    draft = {
        "target_website_types": [
            "Auto parts industry blogs",
            "Import/export trade directories",
            "Mechanic association resource pages",
        ],
        "outreach_draft": (
            f"Subject: Resource link — {code} engine buyer guide for importers\n\n"
            f"We maintain a verified {code} engine resource for importers at {_full_url(path)}. "
            f"If useful for your audience, we'd appreciate a reference link. No payment — value-add resource."
        ),
        "value_proposition": f"Free technical resource helping importers evaluate {code} supply and export process",
        "suggested_landing_page": _full_url(path),
        "publishing_recommendation": "CEO approval before any outreach email",
    }
    return [_asset_shell(mission, asset_type="backlink_outreach_pack", draft_content=draft, category="backlinks", destination_path=path)]


def _email_assets(mission: dict[str, Any]) -> list[dict[str, Any]]:
    country = mission.get("country") or "Ghana"
    code = mission.get("engine_code") or "G4KD"
    path = _destination_path(code)
    draft = {
        "newsletter_subject": f"{country} Market — Verified {code} Stock & Export Update",
        "preview_text": f"This week's {code} availability and export terms for {country} importers",
        "newsletter_body": (
            f"Dear importer,\n\n"
            f"We have updated {code} export stock with VIN-verified units suitable for {country} buyers.\n"
            f"View specs: {_full_url(path)}\n\n"
            f"Reply on WhatsApp for today's list and CIF/FOB terms.\n\n"
            f"AsiaPower Team"
        ),
        "cta": _cta(code, country),
        "publishing_recommendation": "CEO approval before send — draft only",
    }
    return [_asset_shell(
        mission,
        asset_type="email_newsletter_pack",
        draft_content=draft,
        category="emails",
        target_audience=f"{country} engine importers on mailing list",
        destination_path=path,
    )]


def _generic_landing_assets(mission: dict[str, Any]) -> list[dict[str, Any]]:
    """Fallback pack for catalog, FAQ, content improvement, country expansion."""
    return _landing_page_assets(mission)


_GENERATORS: dict[str, Any] = {
    "landing_page": _landing_page_assets,
    "engine_guide": _engine_guide_assets,
    "social_content": _facebook_assets,
    "youtube_topic": _youtube_assets,
    "linkedin_engagement": _linkedin_assets,
    "forum_discovery": _forum_assets,
    "backlink_opportunity": _backlink_assets,
    "partnership_traffic": _backlink_assets,
    "outreach": _email_assets,
    "catalog_expansion": _generic_landing_assets,
    "content_improvement": _generic_landing_assets,
    "faq_creation": _generic_landing_assets,
    "country_expansion": _generic_landing_assets,
}


def generate_draft_assets(
    missions: list[dict[str, Any]],
    *,
    max_missions: int = 40,
) -> list[dict[str, Any]]:
    assert_apbd_no_browser_ui("DraftAssets.generate_draft_assets")
    assets: list[dict[str, Any]] = []
    seen: set[str] = set()
    priority_order = {"S": 0, "A": 1, "B": 2}
    ranked = sorted(missions, key=lambda m: (priority_order.get(m.get("priority", "B"), 3), -m.get("impact_score", 0)))

    for mission in ranked[:max_missions]:
        mtype = mission.get("mission_type") or ""
        gen = _GENERATORS.get(mtype, _generic_landing_assets)
        for asset in gen(mission):
            aid = asset["asset_id"]
            if aid in seen:
                continue
            seen.add(aid)
            assets.append(asset)
    return assets


def save_draft_assets(
    assets: list[dict[str, Any]],
    *,
    day: str | None = None,
) -> dict[str, Any]:
    day_str = day or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    root = day_runtime_dir(day_str) / "draft_assets"
    root.mkdir(parents=True, exist_ok=True)

    categories = ["landing_pages", "social", "youtube", "linkedin", "forums", "backlinks", "emails"]
    for cat in categories:
        (root / cat).mkdir(parents=True, exist_ok=True)

    by_category: dict[str, list[dict[str, Any]]] = {c: [] for c in categories}
    for asset in assets:
        cat = asset.get("category") or "landing_pages"
        if cat not in by_category:
            cat = "landing_pages"
        by_category[cat].append(asset)
        asset_path = root / cat / f"{asset['asset_id']}.json"
        asset_path.write_text(json.dumps(asset, indent=2, ensure_ascii=False), encoding="utf-8")

    all_json = root / "all-draft-assets.json"
    all_json.write_text(
        json.dumps({
            "generated_at": _now_iso(),
            "day": day_str,
            "asset_count": len(assets),
            "upgrade": "UPGRADE-001",
            "assets": assets,
        }, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    csv_path = root / "draft-assets.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=_CSV_FIELDS)
        writer.writeheader()
        for row in assets:
            writer.writerow({
                "Asset ID": row.get("asset_id", ""),
                "Mission ID": row.get("mission_id", ""),
                "Mission Title": row.get("mission_title", ""),
                "Asset Type": row.get("asset_type", ""),
                "Traffic Source": row.get("traffic_source", ""),
                "Target Audience": row.get("target_audience", ""),
                "Business Goal": row.get("business_goal", ""),
                "Recommended CTA": row.get("recommended_cta", ""),
                "Recommended Destination URL": row.get("recommended_destination_url", ""),
                "Approval Status": row.get("approval_status", _APPROVAL_STATUS),
                "Generated Time": row.get("generated_at", ""),
                "Category": row.get("category", ""),
            })

    approval_items = [
        {
            "asset_id": a["asset_id"],
            "mission_id": a["mission_id"],
            "mission_title": a.get("mission_title", ""),
            "asset_type": a.get("asset_type", ""),
            "traffic_source": a.get("traffic_source", ""),
            "category": a.get("category", ""),
            "approval_status": a.get("approval_status", _APPROVAL_STATUS),
            "recommended_destination_url": a.get("recommended_destination_url", ""),
            "file": f"{a.get('category', 'landing_pages')}/{a['asset_id']}.json",
        }
        for a in assets
    ]
    approval_path = root / "approval_queue.json"
    approval_payload = {
        "generated_at": _now_iso(),
        "day": day_str,
        "upgrade": "UPGRADE-001",
        "description": "CEO approval queue — no auto publish, send, or deploy",
        "pending_count": sum(1 for a in assets if a.get("approval_status") == _APPROVAL_STATUS),
        "approved_count": 0,
        "rejected_count": 0,
        "items": approval_items,
    }
    approval_path.write_text(json.dumps(approval_payload, indent=2, ensure_ascii=False), encoding="utf-8")

    summary = {
        "generated_at": _now_iso(),
        "day": day_str,
        "asset_count": len(assets),
        "by_category": {k: len(v) for k, v in by_category.items() if v},
        "pending_approval": approval_payload["pending_count"],
        "files": {
            "all_json": all_json.name,
            "csv": csv_path.name,
            "approval_queue": approval_path.name,
        },
    }
    summary_path = root / "summary.json"
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")

    return {
        "draft_assets_dir": str(root),
        "all_json_path": str(all_json),
        "csv_path": str(csv_path),
        "approval_queue_path": str(approval_path),
        "summary_path": str(summary_path),
        "asset_count": len(assets),
        "pending_approval": approval_payload["pending_count"],
        "summary": summary,
    }
