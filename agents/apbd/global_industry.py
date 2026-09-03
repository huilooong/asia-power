"""Global, industry-segmented APBD research worker.

The worker deliberately stops before outreach.  It combines the public-source
lead finder, the solo-trade campaign/scoring workspace, and the canonical APBD
company repository while keeping country-specific send gates independent.
"""

from __future__ import annotations

import json
import os
import re
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG_PATH = ROOT / "config" / "apbd_global_industry.yaml"
STATE_PATH = ROOT / "runtime" / "apbd" / "global_industry" / "state.json"
REPORT_DIR = ROOT / "runtime" / "apbd" / "global_industry" / "reports"

REQUIRED_SCOPE_IDS = (
    "parts_wholesaler",
    "export_dealer",
    "repair_workshop",
    "fleet_operator",
    "retail_parts_store",
    "regional_dealer",
)

SCOPE_PATTERNS: dict[str, tuple[str, ...]] = {
    "parts_wholesaler": (
        r"\bwholesal(?:e|er|ers|ing)\b",
        r"\bparts? distributor\b",
        r"\bdistribut(?:e|es|ing) (?:automotive )?(?:spare )?parts\b",
        r"\bdistribution (?:company|center|centre|network)\b",
        r"\bmayorista\b|\bdistribuidor(?:a|es)?\b",
        r"\batacadista\b|\bdistribuidor(?:a|es)?\b",
        r"\bgrossiste\b|\bdistributeur\b",
        r"\bgrosshandel\b|\bgro(?:ss|ß)h[aä]ndler\b",
        r"\bgrossista\b|\bdistributore\b",
        r"\bgroothandel\b",
        r"\btoptanc[ıi]\b",
        r"\bgrosir\b|\bpemborong\b",
        r"批发|卸売|도매",
        r"جملة",
    ),
    "export_dealer": (
        r"\bexport(?:er|ers|ing|s)?\b",
        r"\bexport dealer\b|\bexport distributor\b",
        r"\bexportador(?:a|es)?\b|\bexportaci[oó]n\b",
        r"\bexporta(?:dor|dora|cao|ção|ções)\b",
        r"\bexportateur\b|\bexportation\b",
        r"\bexporteur\b|\bexporth[aä]ndler\b",
        r"\besportatore\b|\besportazione\b",
        r"\bihracat(?:c[ıi]|çı|ci|çısı)?\b",
        r"\beksportir\b|\bpengeksport\b|\bxuat khau\b",
        r"出口|輸出|수출",
        r"تصدير|مصدر",
    ),
    "repair_workshop": (
        r"\b(?:auto|automotive|vehicle|truck|commercial vehicle) repair\b",
        r"\brepair (?:shop|workshop|garage|centre|center)\b",
        r"\bworkshop\b|\bgarage\b|\bservice cent(?:er|re)\b",
        r"\btaller\b|\breparaci[oó]n\b",
        r"\boficina mec[aâ]nica\b|\boficina automotiva\b",
        r"\batelier\b|\br[eé]paration automobile\b",
        r"\bwerkstatt\b|\bkfz[- ]?service\b",
        r"\bofficina\b|\bautogarage\b",
        r"\bbengkel\b|\bxuong sua chua\b",
        r"维修|修理厂|整備工場|정비소",
        r"ورشة|صيانة سيارات",
    ),
    "fleet_operator": (
        r"\bfleet operator\b|\boperates? (?:a|our|the) fleet\b|\bour fleet\b",
        r"\btransport(?:ation)? company\b|\blogistics company\b",
        r"\boperador(?:a)? de flota\b|\bnuestra flota\b",
        r"\boperador(?:a)? de frota\b|\bnossa frota\b",
        r"\bop[eé]rateur de flotte\b|\bnotre flotte\b",
        r"\bflottenbetreiber\b|\beigene flotte\b",
        r"\boperatore flotta\b|\bnostra flotta\b",
        r"\bwagenparkbeheer\b|\beigen wagenpark\b",
        r"\bfilo operat[oö]r[üu]\b|\boperator armada\b",
        r"车队运营|自有车队|フリート運営|차량 운영",
        r"مشغل اسطول|أسطولنا",
    ),
    "retail_parts_store": (
        r"\bparts? retail(?:er| store)?\b|\bretail parts?\b",
        r"\bparts? (?:store|shop)\b|\bspare parts? shop\b",
        r"\btienda (?:de )?repuestos\b|\bventa al por menor\b",
        r"\bloja (?:de )?autope[cç]as\b|\bvarejista\b",
        r"\bmagasin (?:de )?pi[eè]ces\b|\bvente au d[eé]tail\b",
        r"\beinzelhandel\b|\bteileladen\b",
        r"\bnegozio ricambi\b|\bdetailhandel\b",
        r"\bperakende ma[gğ]aza\b|\btoko (?:eceran )?suku cadang\b",
        r"零售|门店|小売店|소매점",
        r"متجر تجزئة",
    ),
    "regional_dealer": (
        r"\bregional (?:auto|automotive|vehicle|truck) dealer\b",
        r"\bauthori[sz]ed dealer\b|\bfranchised dealer\b|\bdealership\b",
        r"\bconcesionario\b|\bconcessionaria\b|\bconcessionnaire\b",
        r"\bautohaus\b|\bautoh[aä]ndler\b|\bconcessionario\b",
        r"\bautodealer\b|\botomotiv bayisi\b",
        r"\bdealer otomotif\b|\bpengedar automotif\b",
        r"区域经销商|授权经销商|自動車ディーラー|자동차 딜러",
        r"وكيل سيارات|موزع معتمد",
    ),
}

SERVICE_SCOPE_MAP = {
    "engine_replacement": "repair_workshop",
    "used_engine_installation": "repair_workshop",
    "engine_rebuilding": "repair_workshop",
    "engine_repair": "repair_workshop",
    "engine_diagnostics": "repair_workshop",
    "transmission_replacement": "repair_workshop",
    "transmission_repair": "repair_workshop",
    "used_transmission_installation": "repair_workshop",
    "hybrid_repair": "repair_workshop",
    "ev_repair": "repair_workshop",
    "diesel_repair": "repair_workshop",
    "commercial_vehicle": "repair_workshop",
    "general_repair": "repair_workshop",
    "used_parts_sales": "retail_parts_store",
    "auto_parts_sales": "retail_parts_store",
}

CLASSIFICATION_TIE_ORDER = (
    "export_dealer",
    "parts_wholesaler",
    "fleet_operator",
    "regional_dealer",
    "retail_parts_store",
    "repair_workshop",
)

ROLE_PRIORITY = (
    "purchasing manager",
    "procurement manager",
    "parts manager",
    "operations manager",
    "fleet manager",
    "general manager",
    "director",
    "president",
    "owner",
    "founder",
    "ceo",
)

RESEARCH_FIELDS = (
    "company_name",
    "city_country",
    "official_website",
    "public_email",
    "public_email_source",
    "email_evidence_url",
    "email_evidence_text",
    "checked_at",
    "publication_entity",
    "primary_activity_scope",
    "classification_reason",
    "target_position",
    "decision_maker",
    "primary_language",
    "products_and_brands",
    "dedupe_result",
    "commercial_restriction_check",
    "unsubscribe_status",
    "country_compliance_basis",
    "restricted_party_screening",
    "research_status",
    "draft_status",
    "send_status",
    "send_time",
    "gmail_message_id",
    "reply_status",
    "intent",
)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _atomic_write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=str(path.parent))
    try:
        with open(fd, "w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        Path(tmp_name).replace(path)
    except Exception:
        Path(tmp_name).unlink(missing_ok=True)
        raise


def load_config(path: Path | str = DEFAULT_CONFIG_PATH) -> dict[str, Any]:
    try:
        import yaml  # type: ignore
    except ImportError as exc:  # pragma: no cover - production dependency guard
        raise RuntimeError("PyYAML is required for APBD global industry config") from exc
    config_path = Path(path)
    if not config_path.is_file():
        raise ValueError(f"Global industry config not found: {config_path}")
    data = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("Global industry config must be a YAML object")
    validate_config(data)
    return data


def validate_config(config: dict[str, Any]) -> None:
    governance = config.get("governance") or {}
    if governance.get("worker_external_draft_enabled") is not False:
        raise ValueError("Global worker external drafting must remain disabled")
    if governance.get("worker_external_send_enabled") is not False:
        raise ValueError("Global worker external sending must remain disabled")
    if list(governance.get("allowed_auto_send_country_codes") or []):
        raise ValueError("Global worker auto-send allowlist must be empty")
    separate = {str(value).upper() for value in governance.get("separate_send_gate_country_codes") or []}
    if not separate.issubset({"CA", "VE"}):
        raise ValueError("Only CA and VE may reference a separate external send gate")
    if governance.get("third_party_email_send_eligible") is not False:
        raise ValueError("Third-party emails must never be send-eligible")
    if governance.get("importer_alone_is_exporter") is not False:
        raise ValueError("Importer-only evidence must not classify an export dealer")

    scopes = [row for row in config.get("industry_scopes") or [] if isinstance(row, dict)]
    scope_ids = tuple(str(row.get("id") or "") for row in scopes)
    if scope_ids != REQUIRED_SCOPE_IDS:
        raise ValueError(f"industry_scopes must be exactly {', '.join(REQUIRED_SCOPE_IDS)}")
    for scope in scopes:
        terms = scope.get("search_terms") or {}
        if not isinstance(terms, dict) or not list(terms.get("en") or []):
            raise ValueError(f"Scope {scope.get('id')} requires English fallback search terms")
        if not str(scope.get("target_role") or "").strip():
            raise ValueError(f"Scope {scope.get('id')} requires target_role")

    markets = [row for row in config.get("markets") or [] if isinstance(row, dict)]
    if len(markets) < 20:
        raise ValueError("Global config requires at least 20 prioritized markets")
    codes = [str(row.get("code") or "").upper() for row in markets]
    if codes[:4] != ["CA", "VE", "US", "MX"]:
        raise ValueError("Market order must begin CA, VE, US, MX")
    if len(codes) != len(set(codes)):
        raise ValueError("Market country codes must be unique")
    excluded = {str(value).upper() for value in governance.get("excluded_country_codes") or []}
    if "GH" not in excluded:
        raise ValueError("Ghana must remain excluded")
    overlap = excluded.intersection(codes)
    if overlap:
        raise ValueError(f"Excluded markets cannot be configured: {', '.join(sorted(overlap))}")
    for market in markets:
        code = str(market.get("code") or "").upper()
        if len(code) != 2 or not str(market.get("country") or "").strip():
            raise ValueError(f"Invalid market row: {market}")
        if not list(market.get("cities") or []):
            raise ValueError(f"Market {code} requires at least one city")
        policy = str(market.get("policy_mode") or "")
        if code == "CA" and policy != "casl_strict":
            raise ValueError("Canada must use casl_strict")
        if code == "VE" and policy != "sanctions_strict":
            raise ValueError("Venezuela must use sanctions_strict")
        if code not in {"CA", "VE"} and policy != "research_draft_only":
            raise ValueError(f"{code} must remain research_draft_only")


def assert_runtime_send_disabled() -> None:
    raw = str(os.getenv("APBD_GLOBAL_EXTERNAL_SEND_ENABLED") or "0").strip().casefold()
    if raw not in {"", "0", "false", "no", "off"}:
        raise RuntimeError("APBD global worker has no external-send mode")


def read_state(path: Path = STATE_PATH) -> dict[str, Any]:
    path = Path(path)
    if not path.is_file():
        return {"version": 1, "runs": 0, "market_cursor": 0, "market_visits": {}, "campaign_ids": {}}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {"version": 1, "runs": 0, "market_cursor": 0, "market_visits": {}, "campaign_ids": {}}


def build_market_schedule(config: dict[str, Any]) -> list[str]:
    """Weighted, fair order: CA first, VE second, then worldwide markets."""
    markets = sorted(
        [row for row in config.get("markets") or [] if isinstance(row, dict)],
        key=lambda row: (int(row.get("priority") or 99), list(config.get("markets") or []).index(row)),
    )
    max_weight = max(max(1, int(row.get("weight") or 1)) for row in markets)
    schedule: list[str] = []
    for weight_round in range(max_weight):
        for market in markets:
            if max(1, int(market.get("weight") or 1)) > weight_round:
                schedule.append(str(market["code"]).upper())
    return schedule


def select_work_item(config: dict[str, Any], state: dict[str, Any]) -> dict[str, Any]:
    schedule = build_market_schedule(config)
    if not schedule:
        raise ValueError("No market schedule available")
    cursor = int(state.get("market_cursor") or 0) % len(schedule)
    code = schedule[cursor]
    market = next(row for row in config["markets"] if str(row.get("code") or "").upper() == code)
    scopes = config["industry_scopes"]
    visits = int((state.get("market_visits") or {}).get(code) or 0)
    scope = scopes[visits % len(scopes)]
    language = str(market.get("language") or "en")
    terms_map = scope.get("search_terms") or {}
    terms = list(terms_map.get(language) or terms_map.get("en") or [])
    cities = [str(value) for value in market.get("cities") or []]
    city_index = (visits // len(scopes)) % len(cities)
    term_index = (visits // (len(scopes) * len(cities))) % len(terms)
    city = cities[city_index]
    term = str(terms[term_index])
    country = str(market["country"])
    return {
        "market_cursor": cursor,
        "market_schedule_size": len(schedule),
        "country_code": code,
        "country": country,
        "city": city,
        "language": language,
        "policy_mode": str(market["policy_mode"]),
        "industry_id": str(scope["id"]),
        "industry_label_zh": str(scope["label_zh"]),
        "target_role": str(scope["target_role"]),
        "customer_type": str(scope["customer_type"]),
        "query": " ".join(f"{term} {city} {country}".split()),
    }


def advance_state(state: dict[str, Any], work_item: dict[str, Any], *, now: str) -> None:
    schedule_size = max(1, int(work_item.get("market_schedule_size") or 1))
    state["version"] = 1
    state["market_cursor"] = (int(work_item.get("market_cursor") or 0) + 1) % schedule_size
    state["runs"] = int(state.get("runs") or 0) + 1
    code = str(work_item["country_code"])
    visits = dict(state.get("market_visits") or {})
    visits[code] = int(visits.get(code) or 0) + 1
    state["market_visits"] = visits
    state["last_run_at"] = now
    state["last_work_item"] = dict(work_item)


def tag_discovered_lead(lead: dict[str, Any], work_item: dict[str, Any], *, checked_at: str) -> dict[str, Any]:
    row = dict(lead)
    email = str(row.get("public_email") or "").strip()
    discovered_source = str(row.get("data_source") or row.get("source") or "public_source")
    row.update(
        {
            "country": work_item["country"],
            "country_code": work_item["country_code"],
            "city": str(row.get("city") or work_item["city"]),
            "industry": work_item["industry_id"],
            "development_segment": work_item["industry_id"],
            "target_activity_scope": work_item["industry_id"],
            "primary_activity_scope": "",
            "activity_scope_status": "pending_official_website_evidence",
            "classification_reason": "Search target only; primary activity requires first-party website evidence.",
            "target_position": work_item["target_role"],
            "primary_language": work_item["language"],
            "policy_mode": work_item["policy_mode"],
            "research_status": "discovered_pending_official_research",
            "draft_status": "queued_blocked_pending_localized_country_compliance_template",
            "send_status": "blocked_global_worker_no_send",
            "auto_send_eligible": False,
            "unsubscribe_status": "not_applicable_no_message_created",
            "dedupe_result": "pending_canonical_repository_sync",
            "restricted_party_screening": {
                "status": "pending",
                "checked_at": "",
                "method": "separate_country_compliance_gate_required",
            },
            "global_discovery": {
                "checked_at": checked_at,
                "query": work_item["query"],
                "source": discovered_source,
                "source_url": row.get("source_url") or row.get("company_page_url") or "",
                "email_is_send_evidence": False,
            },
        }
    )
    row["match_reason"] = (
        f"Discovered for {work_item['industry_label_zh']} research in "
        f"{work_item['city']}, {work_item['country']}; classification remains unverified."
    )
    row["value_reason"] = "Potential buyer profile; official website evidence is still required."
    if email and email.casefold() != "not published":
        row["public_email_source"] = str(row.get("public_email_source") or discovered_source)
        row["candidate_email_send_eligible"] = False
    return row


def _official_evidence(company: dict[str, Any]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    description = str(company.get("description") or "").strip()
    description_url = str(company.get("description_evidence_url") or "").strip()
    if description and description_url.startswith(("http://", "https://")):
        rows.append({"text": description, "url": description_url, "kind": "official_description"})
    for service in company.get("services") or []:
        if not isinstance(service, dict) or str(service.get("source_type") or "") != "website":
            continue
        text = str(service.get("evidence_text") or "").strip()
        url = str(service.get("evidence_url") or "").strip()
        if text and url.startswith(("http://", "https://")):
            rows.append({"text": text, "url": url, "kind": "official_service"})
    return rows


def classify_primary_activity(company: dict[str, Any]) -> dict[str, Any]:
    """Classify only from first-party evidence; query text is intentionally excluded."""
    evidence = _official_evidence(company)
    scores = {scope_id: 0 for scope_id in REQUIRED_SCOPE_IDS}
    first_match: dict[str, dict[str, str]] = {}

    for item in evidence:
        text = item["text"]
        for scope_id, patterns in SCOPE_PATTERNS.items():
            for pattern in patterns:
                match = re.search(pattern, text, re.I)
                if not match:
                    continue
                scores[scope_id] += 1
                first_match.setdefault(
                    scope_id,
                    {
                        "url": item["url"],
                        "text": _evidence_snippet(text, match.start(), match.end()),
                        "kind": item["kind"],
                    },
                )

    for service in company.get("services") or []:
        if not isinstance(service, dict) or str(service.get("source_type") or "") != "website":
            continue
        scope_id = SERVICE_SCOPE_MAP.get(str(service.get("service_code") or ""))
        if not scope_id:
            continue
        scores[scope_id] += 1
        first_match.setdefault(
            scope_id,
            {
                "url": str(service.get("evidence_url") or ""),
                "text": str(service.get("evidence_text") or "")[:300],
                "kind": "official_service_code",
            },
        )

    positive = [scope for scope in CLASSIFICATION_TIE_ORDER if scores.get(scope, 0) > 0]
    if not positive:
        return {
            "scope": "",
            "status": "pending_official_website_evidence",
            "reason": "No first-party text currently proves one of the six primary activities.",
            "evidence_url": "",
            "evidence_text": "",
            "scores": scores,
        }
    max_score = max(scores[scope] for scope in positive)
    winner = next(scope for scope in CLASSIFICATION_TIE_ORDER if scores.get(scope, 0) == max_score)
    matched = first_match[winner]
    reason = f"First-party website evidence matched {winner}; selected by strongest match with deterministic tie order."
    if winner == "export_dealer":
        reason += " Explicit export wording is present; import wording alone is never sufficient."
    return {
        "scope": winner,
        "status": "classified_from_official_website",
        "reason": reason,
        "evidence_url": matched["url"],
        "evidence_text": matched["text"],
        "scores": scores,
    }


def _evidence_snippet(text: str, start: int, end: int, *, radius: int = 120) -> str:
    clean = re.sub(r"\s+", " ", text).strip()
    if len(clean) <= radius * 2:
        return clean[:300]
    left = max(0, start - radius)
    right = min(len(clean), end + radius)
    return clean[left:right].strip()[:300]


def _official_email_record(company: dict[str, Any]) -> dict[str, Any]:
    candidates: list[dict[str, Any]] = []
    for channel in company.get("contact_channels") or []:
        if not isinstance(channel, dict) or channel.get("type") != "email":
            continue
        source = str(channel.get("source") or "")
        if not source.startswith("official_website"):
            channel["send_eligible"] = False
            channel.setdefault("send_block_reason", "not_first_party_publication")
            continue
        url = str(channel.get("evidence_url") or "")
        text = str(channel.get("evidence_text") or "")
        channel["send_eligible"] = False
        channel["send_block_reason"] = "country_and_message_gate_not_completed"
        candidates.append(
            {
                "email": str(channel.get("value") or ""),
                "source": source,
                "evidence_url": url,
                "evidence_text": text,
                "observed_at": str(channel.get("observed_at") or ""),
                "publication_entity": "recipient_company_official_website",
                "conspicuous_publication_evidence_complete": bool(url and text),
                "commercial_restriction_check": channel.get("commercial_restriction_check")
                or {"status": "pending", "checked_at": "", "evidence_url": url},
            }
        )
    if not candidates:
        return {
            "email": "",
            "source": "",
            "evidence_url": "",
            "evidence_text": "",
            "observed_at": "",
            "publication_entity": "",
            "conspicuous_publication_evidence_complete": False,
            "commercial_restriction_check": {"status": "pending", "checked_at": "", "evidence_url": ""},
        }
    return next(
        (row for row in candidates if row["conspicuous_publication_evidence_complete"]),
        candidates[0],
    )


def _decision_record(company: dict[str, Any], target_role: str) -> dict[str, Any]:
    people = []
    for person in company.get("contact_persons") or []:
        if not isinstance(person, dict):
            continue
        name = str(person.get("name") or "").strip()
        title = str(person.get("title") or person.get("role") or "").strip()
        evidence_url = str(person.get("evidence_url") or "").strip()
        evidence_text = str(person.get("evidence_text") or "").strip()
        if name and title and evidence_url.startswith(("http://", "https://")) and evidence_text:
            people.append(
                {
                    "name": name,
                    "title": title,
                    "evidence_url": evidence_url,
                    "evidence_text": evidence_text,
                    "source": str(person.get("source") or "official_website"),
                    "current_status": "current_as_published_on_checked_official_page",
                }
            )
    if not people:
        return {
            "status": "role_target_only_no_named_person_claim",
            "target_position": target_role,
            "person": {},
        }

    def rank(person: dict[str, Any]) -> int:
        title = person["title"].casefold()
        return next((index for index, value in enumerate(ROLE_PRIORITY) if value in title), len(ROLE_PRIORITY))

    people.sort(key=rank)
    return {"status": "evidence_backed_named_person", "target_position": target_role, "person": people[0]}


def _compliance_basis(country_code: str, policy_mode: str) -> str:
    if country_code == "CA":
        return (
            "CASL strict gate: first-party conspicuous publication, no contrary statement, role relevance, "
            "sender identity/address and reply unsubscribe evidence are all required outside this worker."
        )
    if country_code == "VE":
        return (
            "Venezuela separate gate: current sanctions/restricted-party association screening, recipient "
            "relevance, opt-out and delivery controls are required outside this worker."
        )
    return f"{policy_mode}: country-specific outreach rules are not validated; research and CRM only."


def apply_research_profile(
    company: dict[str, Any],
    work_item: dict[str, Any],
    *,
    checked_at: str,
    dedupe_result: str,
) -> dict[str, Any]:
    classification = classify_primary_activity(company)
    scope_by_id = {row["id"]: row for row in work_item["config_scopes"]}
    final_scope = classification["scope"]
    existing_profile = company.get("global_industry_development") or {}
    existing_target = str(existing_profile.get("target_activity_scope") or "")
    if existing_target not in scope_by_id:
        existing_target = ""
    target_scope = final_scope or existing_target or work_item["industry_id"]
    target_role = str(scope_by_id[target_scope]["target_role"])
    email = _official_email_record(company)
    decision = _decision_record(company, target_role)
    website = next(
        (
            str(channel.get("value") or "")
            for channel in company.get("contact_channels") or []
            if isinstance(channel, dict) and channel.get("type") == "website"
        ),
        "",
    )
    services = sorted(
        {str(row.get("service_code") or "") for row in company.get("services") or [] if isinstance(row, dict) and row.get("service_code")}
    )
    brands = sorted(
        {str(row.get("brand_code") or "") for row in company.get("brands") or [] if isinstance(row, dict) and row.get("brand_code")}
    )
    enrichment = company.get("website_enrichment") or {}
    enrichment_status = str(enrichment.get("status") or "not_attempted")
    research_status = "official_website_research_complete" if enrichment_status == "complete" else f"pending_{enrichment_status}"
    send_block = {
        "CA": "blocked_pending_full_casl_evidence_and_message_gate",
        "VE": "blocked_pending_sanctions_and_country_gate",
    }.get(str(work_item["country_code"]), "blocked_country_rules_not_validated")

    profile = {
        "schema_version": "apbd-global-industry-profile-v1",
        "company_name": str(company.get("display_name") or company.get("legal_name") or ""),
        "city_country": f"{(company.get('location') or {}).get('city') or work_item['city']}, {work_item['country']}",
        "official_website": website,
        "public_email": email["email"],
        "public_email_source": email["source"],
        "email_evidence_url": email["evidence_url"],
        "email_evidence_text": email["evidence_text"],
        "checked_at": checked_at,
        "publication_entity": email["publication_entity"],
        "target_activity_scope": target_scope,
        "primary_activity_scope": final_scope,
        "activity_scope_status": classification["status"],
        "classification_reason": classification["reason"],
        "classification_evidence_url": classification["evidence_url"],
        "classification_evidence_text": classification["evidence_text"],
        "classification_scores": classification["scores"],
        "target_position": target_role,
        "decision_maker": decision,
        "primary_language": work_item["language"],
        "products_and_brands": {"services": services, "brands": brands},
        "dedupe_result": dedupe_result,
        "commercial_restriction_check": email["commercial_restriction_check"],
        "unsubscribe_status": "not_applicable_no_message_created",
        "country_compliance_basis": _compliance_basis(
            str(work_item["country_code"]), str(work_item["policy_mode"])
        ),
        "restricted_party_screening": {
            "status": "pending_separate_gate",
            "checked_at": "",
            "method": "current_public_name_and_association_screen_required_before_any_send",
        },
        "research_status": research_status,
        "draft_status": "queued_blocked_pending_localized_country_compliance_template",
        "draft_queue": {
            "status": "blocked_no_message_generated",
            "required_language": work_item["language"],
            "required_personalization_evidence": True,
            "required_country_rule_validation": True,
        },
        "send_status": send_block,
        "send_time": "",
        "gmail_message_id": "",
        "reply_status": "none",
        "intent": "unknown",
        "auto_send_eligible": False,
        "worker_external_send_enabled": False,
        "linkedin_cross_check": company.get("linkedin_review")
        or {"status": "pending_public_cross_check", "public_links": []},
        "apsales_handoff": {
            "commercial_source_of_truth": "APSales",
            "trigger": "verified_inbound_reply_or_qualified_opportunity",
            "status": "not_triggered_no_reply",
        },
    }
    missing = [field for field in RESEARCH_FIELDS if field not in profile]
    if missing:  # pragma: no cover - schema programmer guard
        raise RuntimeError(f"Research profile missing fields: {missing}")
    company["global_industry_development"] = profile
    company["primary_activity_scope"] = final_scope
    company["activity_scope_status"] = classification["status"]
    company["activity_scope_reason"] = classification["reason"]
    company["primary_language"] = str(company.get("primary_language") or work_item["language"])
    company["global_worker_auto_send_eligible"] = False
    company["global_worker_send_status"] = send_block
    company["global_research_checked_at"] = checked_at
    company.setdefault("draft_status", "queued_blocked_pending_localized_country_compliance_template")
    company.setdefault("send_status", send_block)
    company.setdefault("send_time", "")
    company.setdefault("gmail_message_id", "")
    company.setdefault("reply_status", "none")
    company.setdefault("intent", "unknown")
    return company


def _has_website(company: dict[str, Any]) -> bool:
    return any(
        isinstance(row, dict)
        and row.get("type") == "website"
        and bool(str(row.get("value") or "").strip())
        and str(row.get("value") or "").strip().casefold() != "not published"
        for row in company.get("contact_channels") or []
    )


def select_backlog(
    companies: list[dict[str, Any]],
    *,
    country_code: str,
    limit: int,
    retry_after_days: int,
    now: datetime | None = None,
) -> list[dict[str, Any]]:
    if limit <= 0:
        return []
    current = now or datetime.now(timezone.utc)
    retry_before = current - timedelta(days=max(1, int(retry_after_days)))
    rows: list[dict[str, Any]] = []
    for company in companies:
        if str(company.get("country_code") or "").upper() != country_code.upper():
            continue
        if company.get("do_not_contact"):
            continue
        enrichment = company.get("website_enrichment") or {}
        status = str(enrichment.get("status") or "")
        if status == "failed":
            raw = str(enrichment.get("attempted_at") or "")
            try:
                attempted = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            except ValueError:
                attempted = datetime.min.replace(tzinfo=timezone.utc)
            if attempted > retry_before:
                continue
        has_profile = isinstance(company.get("global_industry_development"), dict)
        if status in {"complete", "unsupported_website", "no_website"} and has_profile:
            continue
        if not _has_website(company) and has_profile:
            continue
        rows.append(company)
    rows.sort(key=lambda row: (str(row.get("created_at") or ""), str(row.get("display_name") or "")))
    return rows[:limit]


def _ensure_campaign(service: Any, state: dict[str, Any], config: dict[str, Any], work_item: dict[str, Any]) -> str:
    from agents.apbd.solo_trade.models import CampaignBrief

    scope_id = str(work_item["industry_id"])
    campaign_ids = dict(state.get("campaign_ids") or {})
    existing_id = str(campaign_ids.get(scope_id) or "")
    if existing_id:
        try:
            service.load(existing_id)
            return existing_id
        except ValueError:
            pass
    for campaign in service.store.list():
        if str(campaign.get("global_industry_scope") or "") == scope_id:
            campaign_id = str(campaign["campaign_id"])
            campaign_ids[scope_id] = campaign_id
            state["campaign_ids"] = campaign_ids
            return campaign_id

    markets = tuple(str(row["country"]) for row in config["markets"])
    scope = next(row for row in config["industry_scopes"] if row["id"] == scope_id)
    brief = CampaignBrief(
        product_keywords=(
            "original new automotive parts",
            "engines and transmissions",
            "China supplier network",
        ),
        target_markets=markets,
        customer_types=(str(scope["customer_type"]),),
        search_depth=2,
        max_customers=200,
        output_language="en",
        enable_contact_enrichment=False,
        enable_ai_scoring=True,
    )
    campaign = service.create_campaign(brief, name=f"Global industry / {scope['label_zh']}")
    campaign["global_industry_scope"] = scope_id
    campaign["global_worker_external_send_enabled"] = False
    campaign["global_worker_external_draft_enabled"] = False
    campaign["excluded_country_codes"] = list((config.get("governance") or {}).get("excluded_country_codes") or [])
    service.store.save(campaign)
    campaign_id = str(campaign["campaign_id"])
    campaign_ids[scope_id] = campaign_id
    state["campaign_ids"] = campaign_ids
    return campaign_id


def _update_cumulative(state: dict[str, Any], report: dict[str, Any]) -> None:
    cumulative = dict(state.get("cumulative") or {})
    key = f"{report['country_code']}:{report['industry_id']}"
    row = dict(cumulative.get(key) or {})
    for field in (
        "new_candidates",
        "research_completed",
        "qualified_official_emails",
        "compliance_send_ready",
        "actual_sent",
        "auto_blocked",
        "failed",
        "duplicates_skipped",
        "replies",
    ):
        row[field] = int(row.get(field) or 0) + int(report.get(field) or 0)
    cumulative[key] = row
    state["cumulative"] = cumulative


def run_once(
    *,
    config_path: Path | str = DEFAULT_CONFIG_PATH,
    state_path: Path = STATE_PATH,
    report_dir: Path = REPORT_DIR,
    dry_run: bool = False,
    force: bool = False,
    limit: int | None = None,
    load_average: Callable[[], float] | None = None,
    discover: Callable[..., tuple[list[dict[str, Any]], dict[str, Any]]] | None = None,
    service_factory: Callable[[], Any] | None = None,
) -> dict[str, Any]:
    state_path = Path(state_path)
    report_dir = Path(report_dir)
    assert_runtime_send_disabled()
    config = load_config(config_path)
    state = read_state(state_path)
    work_item = select_work_item(config, state)
    work_item["config_scopes"] = config["industry_scopes"]
    public_work_item = {key: value for key, value in work_item.items() if key != "config_scopes"}
    runtime = config.get("runtime") or {}
    load_fn = load_average or (lambda: float(os.getloadavg()[0]))
    try:
        load_1m = float(load_fn())
    except (OSError, AttributeError, ValueError):
        load_1m = 0.0
    load_max = float(runtime.get("load_max") or 1.8)
    if dry_run:
        return {
            "ok": True,
            "dry_run": True,
            "would_write": False,
            "work_item": public_work_item,
            "safety": {
                "external_draft_enabled": False,
                "external_send_enabled": False,
                "ghana_excluded": True,
            },
        }
    if not force and load_1m > load_max:
        return {
            "ok": True,
            "skipped": True,
            "reason": "load_high",
            "load_1m": load_1m,
            "load_max": load_max,
            "work_item": public_work_item,
        }

    now = utc_now_iso()
    batch_limit = max(1, int(limit or runtime.get("batch_limit") or 6))
    errors: list[str] = []
    discovery_stats: dict[str, Any] = {}
    leads: list[dict[str, Any]] = []
    if discover is None:
        from agents.apbd.lead_finder import discover_leads

        discover = discover_leads
    try:
        leads, discovery_stats = discover(
            markets=[
                {
                    "id": f"global_{work_item['country_code']}_{work_item['industry_id']}",
                    "country": work_item["country"],
                    "city": work_item["city"],
                    "queries": [work_item["query"]],
                }
            ],
            max_results_per_query=batch_limit,
            max_total=batch_limit,
            max_queries=1,
        )
    except Exception as exc:
        errors.append(f"discovery:{type(exc).__name__}:{str(exc)[:240]}")
        discovery_stats = {"ok": False, "errors": list(errors), "duplicates_skipped": 0}

    tagged = [tag_discovered_lead(row, work_item, checked_at=now) for row in leads]
    if service_factory is None:
        from agents.apbd.solo_trade.service import SoloTradeService

        service_factory = SoloTradeService
    service = service_factory()
    campaign_id = _ensure_campaign(service, state, config, work_item)
    before_campaign = service.load(campaign_id)
    before_ids = {str(row.get("lead_id") or "") for row in before_campaign.get("leads") or []}
    add_result = service.add_leads(campaign_id, tagged, source="apbd_global_industry_public_discovery")
    after_add = service.load(campaign_id)
    new_lead_ids = [
        str(row.get("lead_id") or "")
        for row in after_add.get("leads") or []
        if str(row.get("lead_id") or "") not in before_ids
    ]
    from agents.apbd.leads.repository import load_companies, upsert_companies_batch

    preexisting_company_ids = {str(row.get("id") or "") for row in load_companies()}
    links: list[dict[str, str]] = []
    for lead_id in new_lead_ids:
        try:
            service.score(campaign_id, lead_id=lead_id)
            synced = service.sync_apbd(campaign_id, lead_id=lead_id)
            links.extend(synced.get("links") or [])
        except Exception as exc:
            errors.append(f"campaign:{lead_id}:{type(exc).__name__}:{str(exc)[:200]}")

    from agents.apbd.leads.adapters.website import enrich_company_from_website
    from agents.apbd.leads.native_enrichment import enrich_company_native
    companies = load_companies()
    company_by_id = {str(row.get("id") or ""): row for row in companies}
    linked_ids = [str(row.get("apbd_company_id") or "") for row in links]
    backlog = select_backlog(
        companies,
        country_code=str(work_item["country_code"]),
        limit=max(0, int(runtime.get("backlog_enrichment_limit") or 0)),
        retry_after_days=int(runtime.get("retry_failed_website_after_days") or 14),
    )
    target_ids = list(dict.fromkeys(linked_ids + [str(row.get("id") or "") for row in backlog]))
    processed: list[dict[str, Any]] = []
    research_completed = 0
    qualified_official_emails = 0
    for company_id in target_ids:
        company = company_by_id.get(company_id)
        if not company:
            errors.append(f"repository:missing_company:{company_id}")
            continue
        try:
            updated = enrich_company_from_website(
                dict(company),
                max_pages=max(1, int(runtime.get("website_pages") or 3)),
                timeout=max(2, int(runtime.get("website_timeout_seconds") or 7)),
            )
            updated, _native = enrich_company_native(updated)
            dedupe_result = (
                "matched_existing_canonical_company"
                if company_id in preexisting_company_ids
                else "new_canonical_company"
            )
            updated = apply_research_profile(
                updated,
                work_item,
                checked_at=now,
                dedupe_result=dedupe_result,
            )
            profile = updated["global_industry_development"]
            research_completed += int(profile["research_status"] == "official_website_research_complete")
            qualified_official_emails += int(
                bool(profile["public_email"] and profile["email_evidence_url"] and profile["email_evidence_text"])
            )
            processed.append(updated)
        except Exception as exc:
            errors.append(f"research:{company_id}:{type(exc).__name__}:{str(exc)[:200]}")
    if processed:
        upsert_companies_batch(processed, source="global_industry_research")

    report = {
        "schema_version": "apbd-global-industry-run-v1",
        "started_at": now,
        "country_code": work_item["country_code"],
        "country": work_item["country"],
        "city": work_item["city"],
        "industry_id": work_item["industry_id"],
        "industry_label_zh": work_item["industry_label_zh"],
        "query": work_item["query"],
        "policy_mode": work_item["policy_mode"],
        "new_candidates": len(new_lead_ids),
        "research_completed": research_completed,
        "qualified_official_emails": qualified_official_emails,
        "compliance_send_ready": 0,
        "actual_sent": 0,
        "auto_blocked": len(target_ids),
        "failed": len(errors),
        "duplicates_skipped": int(discovery_stats.get("duplicates_skipped") or 0) + int(add_result.get("updated") or 0),
        "replies": 0,
        "campaign_id": campaign_id,
        "campaign_add_result": add_result,
        "backlog_selected": len(backlog),
        "repository_profiles_updated": len(processed),
        "load_1m": load_1m,
        "discovery_stats": discovery_stats,
        "errors": errors,
        "safety": {
            "external_draft_enabled": False,
            "external_send_enabled": False,
            "allowed_auto_send_country_codes": [],
            "separate_send_gate_country_codes": ["CA", "VE"],
            "ghana_excluded": True,
            "third_party_email_send_eligible": False,
        },
    }
    advance_state(state, work_item, now=now)
    _update_cumulative(state, report)
    state["last_report"] = report
    _atomic_write_json(state_path, state)
    report_dir.mkdir(parents=True, exist_ok=True)
    report_path = report_dir / f"global-industry-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.json"
    _atomic_write_json(report_path, report)
    return {
        "ok": not errors,
        "skipped": False,
        "report_path": str(report_path),
        **{key: value for key, value in report.items() if key not in {"discovery_stats", "errors"}},
        "errors": errors,
        "api_quota_exhausted": bool(discovery_stats.get("api_quota_exhausted")),
    }
