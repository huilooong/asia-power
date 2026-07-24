"""Explainable lead scoring (versioned YAML weights)."""

from __future__ import annotations

from typing import Any

from agents.apbd.leads.market_config import get_country, load_markets, load_scoring


def _clamp(n: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, n))


def score_company(company: dict[str, Any], *, scoring: dict[str, Any] | None = None) -> dict[str, Any]:
    cfg = scoring or load_scoring()
    version = str(cfg.get("version") or "unknown")
    groups = cfg.get("groups") or {}
    penalties_cfg = cfg.get("penalties") or {}
    bands = cfg.get("priority_bands") or {}

    breakdown: dict[str, Any] = {"groups": {}, "penalties": [], "notes": []}
    total = 0.0

    # --- powertrain ---
    pw = groups.get("powertrain") or {}
    pw_pts = pw.get("points") or {}
    pw_score = 0.0
    svc_codes = {str(s.get("service_code") or "") for s in (company.get("services") or [])}
    for code, pts in pw_pts.items():
        if code in svc_codes:
            pw_score += float(pts)
            breakdown["notes"].append(f"+{pts} powertrain:{code}")
    pw_score = _clamp(pw_score, 0, float(pw.get("max") or 30))
    breakdown["groups"]["powertrain"] = pw_score
    total += pw_score

    # --- asian match ---
    am = groups.get("asian_match") or {}
    am_pts = am.get("points") or {}
    am_score = 0.0
    btype = str(company.get("business_type") or "")
    brands = company.get("brands") or []
    if btype == "asian_vehicle_specialist":
        am_score = float(am_pts.get("asian_vehicle_specialist") or 0)
    elif len(brands) >= 2:
        am_score = float(am_pts.get("multiple_target_brands") or 0)
    elif len(brands) == 1:
        am_score = float(am_pts.get("single_target_brand") or 0)
    elif any(x in svc_codes for x in ("general_repair", "engine_repair")):
        am_score = float(am_pts.get("general_import_repair") or 0)
    am_score = _clamp(am_score, 0, float(am.get("max") or 20))
    breakdown["groups"]["asian_match"] = am_score
    total += am_score

    # --- independence ---
    ind = groups.get("independence") or {}
    ind_pts = ind.get("points") or {}
    chain = str(company.get("chain_status") or "unknown")
    if btype == "used_parts_dealer":
        ind_score = float(ind_pts.get("used_parts_dealer") or 0)
    elif btype == "auto_recycler":
        ind_score = float(ind_pts.get("auto_recycler") or 0)
    elif btype == "dealership_service" or chain == "dealership":
        ind_score = float(ind_pts.get("dealership") or 0)
    elif chain == "national":
        ind_score = float(ind_pts.get("national_chain") or 0)
    elif chain in ("regional", "small_chain"):
        ind_score = float(ind_pts.get("small_regional_chain") or 0)
    else:
        ind_score = float(ind_pts.get("independent_shop") or 0)
    ind_score = _clamp(ind_score, 0, float(ind.get("max") or 15))
    breakdown["groups"]["independence"] = ind_score
    total += ind_score

    # --- reachability ---
    reach = groups.get("reachability") or {}
    reach_pts = reach.get("points") or {}
    reach_score = 0.0
    channels = company.get("contact_channels") or []
    types = {str(c.get("type") or "") for c in channels}
    if "email" in types:
        reach_score += float(reach_pts.get("public_email") or 0)
    if "phone" in types:
        reach_score += float(reach_pts.get("public_phone") or 0)
    if "contact_form" in types:
        reach_score += float(reach_pts.get("contact_form") or 0)
    if "whatsapp" in types:
        reach_score += float(reach_pts.get("whatsapp") or 0)
    if company.get("contact_persons"):
        reach_score += float(reach_pts.get("named_manager_or_owner") or 0)
    reach_score = _clamp(reach_score, 0, float(reach.get("max") or 10))
    breakdown["groups"]["reachability"] = reach_score
    total += reach_score

    # --- activity (heuristic from Places signals) ---
    act_max = float((groups.get("activity") or {}).get("max") or 10)
    act = 0.0
    rating = None
    reviews = None
    for ext in company.get("external_profiles") or []:
        if ext.get("source") == "google_places":
            meta = ext.get("meta") or {}
            rating = meta.get("rating")
            reviews = meta.get("user_rating_count") or meta.get("reviews")
    if rating is not None:
        try:
            act += min(5.0, float(rating))
        except (TypeError, ValueError):
            pass
    if reviews:
        try:
            r = int(reviews)
            if r >= 50:
                act += 3
            elif r >= 10:
                act += 2
            elif r >= 1:
                act += 1
        except (TypeError, ValueError):
            pass
    if any(c.get("type") == "website" for c in channels):
        act += 2
    act = _clamp(act, 0, act_max)
    breakdown["groups"]["activity"] = act
    total += act

    # --- chinese ---
    ch = groups.get("chinese") or {}
    ch_pts = ch.get("points") or {}
    cr_status = str((company.get("chinese_relevance") or {}).get("status") or "unknown")
    ch_score = float(ch_pts.get(cr_status) or 0)
    ch_score = _clamp(ch_score, 0, float(ch.get("max") or 10))
    breakdown["groups"]["chinese"] = ch_score
    total += ch_score

    # --- regional pain ---
    rp_max = float((groups.get("regional_pain") or {}).get("max") or 5)
    rp = 0.0
    try:
        country = get_country(load_markets(), str(company.get("country_code") or "CA"))
        city = str((company.get("location") or {}).get("city") or "").lower()
        for region in country.get("regions") or []:
            cities = {str(x).lower() for x in (region.get("cities") or [])}
            if city in cities:
                rp = float(region.get("regional_pain") or 0)
                break
    except Exception:
        rp = 0.0
    rp = _clamp(rp, 0, rp_max)
    breakdown["groups"]["regional_pain"] = rp
    total += rp

    # --- penalties ---
    pen_total = 0.0
    status_biz = str(company.get("business_status") or "").upper()
    if status_biz in ("CLOSED_PERMANENTLY", "PERMANENTLY_CLOSED"):
        pen = float(penalties_cfg.get("permanently_closed") or -100)
        pen_total += pen
        breakdown["penalties"].append({"code": "permanently_closed", "points": pen})
    if company.get("status") == "rejected" and "duplicate" in str(company.get("notes") or "").lower():
        pen = float(penalties_cfg.get("duplicate") or -100)
        pen_total += pen
        breakdown["penalties"].append({"code": "duplicate", "points": pen})

    flags = set(company.get("classification_flags") or [])
    name_blob = f"{company.get('display_name') or ''} {company.get('description') or ''}".lower()
    mechanical = svc_codes & {
        "engine_repair",
        "engine_replacement",
        "transmission_repair",
        "transmission_replacement",
        "general_repair",
        "engine_rebuilding",
        "used_engine_installation",
    }
    if "detailing_only" in flags or ("detail" in name_blob and not mechanical):
        pen = float(penalties_cfg.get("detailing_only") or -30)
        pen_total += pen
        breakdown["penalties"].append({"code": "detailing_only", "points": pen})
    if "body_shop_only" in flags and not mechanical:
        pen = float(penalties_cfg.get("body_shop_only") or -20)
        pen_total += pen
        breakdown["penalties"].append({"code": "body_shop_only", "points": pen})
    if "oil_change_only_hint" in flags and not mechanical and "oil_change" in svc_codes:
        pen = float(penalties_cfg.get("oil_change_only") or -15)
        pen_total += pen
        breakdown["penalties"].append({"code": "oil_change_only", "points": pen})
    if "tire_service" in svc_codes and not mechanical:
        pen = float(penalties_cfg.get("tire_only_without_mechanical_service") or -10)
        pen_total += pen
        breakdown["penalties"].append({"code": "tire_only_without_mechanical_service", "points": pen})
    if chain == "national":
        pen = float(penalties_cfg.get("national_chain") or -10)
        pen_total += pen
        breakdown["penalties"].append({"code": "national_chain", "points": pen})
    if not types & {"email", "phone", "whatsapp", "contact_form"}:
        pen = float(penalties_cfg.get("no_public_contact") or -5)
        pen_total += pen
        breakdown["penalties"].append({"code": "no_public_contact", "points": pen})

    total += pen_total
    max_score = float(cfg.get("max_score") or 100)
    total = _clamp(total, 0, max_score)

    priority = "D"
    for band, spec in bands.items():
        lo = float(spec.get("min") or 0)
        hi = float(spec.get("max") or 100)
        if lo <= total <= hi:
            priority = str(band)
            break

    return {
        "score": round(total, 1),
        "priority": priority,
        "score_version": version,
        "score_breakdown": breakdown,
    }


def apply_score(company: dict[str, Any]) -> dict[str, Any]:
    result = score_company(company)
    company["score"] = result["score"]
    company["priority"] = result["priority"]
    company["score_version"] = result["score_version"]
    company["score_breakdown"] = result["score_breakdown"]
    return company
