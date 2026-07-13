"""AsiaPower Vehicle Intelligence — Customer Intelligence for Sales Decision.

Final goal: AsiaPower Vehicle Intelligence (not a VIN Decoder product).
VIN is one entry into shared Vehicle Knowledge.

CEO query chain (final):
  1) AsiaPower VIN Knowledge Store (high-confidence → reuse, no external call)
  2) NHTSA vPIC          ← Phase 1 main provider (Provider Reported, not Verified)
  3) @cardog/corgi       ← Phase 2+ offline fallback (NOT implemented in Phase 1)
  4) Manual Review

QXB = 子龙 only; not wired to APSales.

Phase 1 ≠ final solution.
"""

from __future__ import annotations

import hashlib
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_VIN_RE = re.compile(r"\b([A-HJ-NPR-Z0-9]{11,17})\b", re.I)
_NHTSA_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{vin}?format=json"

# Phase marker — do not present NHTSA-only as the final architecture
PHASE = "phase_1_nhtsa"
PROVIDER_CHAIN = ("asia_power_store", "nhtsa_vpic", "corgi_fallback", "manual_review")

_SALES_ASK_LABELS = {
    "product_scope": "Long block / complete engine / gearbox?",
    "quantity": "Quantity?",
    "destination_port": "Destination port?",
}

# verification_status values
VS_PROVIDER_REPORTED = "provider_reported"
VS_VERIFIED = "verified"
VS_MANUAL_REVIEWED = "manual_reviewed"
VS_UNVERIFIED = "unverified"


def workspace_root() -> Path:
    return Path(__file__).resolve().parents[1]


def knowledge_dir(root: Path | None = None) -> Path:
    return (root or workspace_root()) / "data" / "vehicle_knowledge"


def vin_cache_path(root: Path | None = None) -> Path:
    return knowledge_dir(root) / "vin-cache.json"


def observations_path(root: Path | None = None) -> Path:
    return knowledge_dir(root) / "observations.ndjson"


def raw_dir(root: Path | None = None) -> Path:
    return knowledge_dir(root) / "raw"


def empty_compatible_parts() -> dict[str, Any]:
    """Future: one vehicle → many engines / gearboxes / half-cuts / chassis parts."""
    return {
        "engines": [],
        "gearboxes": [],
        "half_cuts": [],
        "chassis_parts": [],
        "relations": [
            # {target_type, target_id, source, confidence, verification_status}
        ],
    }


def mask_vin(vin: str) -> str:
    """Default display / log form: keep first 3 + last 4."""
    v = (vin or "").upper()
    if len(v) < 8:
        return "***"
    return f"{v[:3]}{'*' * (len(v) - 7)}{v[-4:]}"


def vin_hash(vin: str) -> str:
    return hashlib.sha256((vin or "").upper().encode("utf-8")).hexdigest()[:16]


def extract_vin(text: str) -> str:
    m = _VIN_RE.search(text or "")
    return (m.group(1) if m else "").upper()


@dataclass
class VehicleSnapshot:
    """Normalized Vehicle Record for Sales Decision + future VIN Search."""

    vin: str = ""
    vin_masked: str = ""
    vin_hash: str = ""
    brand: str = ""
    model: str = ""
    year: str = ""
    engine_code: str = ""
    engine_desc: str = ""
    transmission: str = ""
    plant_country: str = ""
    # Provider / trust
    provider_source: str = "none"  # asia_power_store | nhtsa_vpic | corgi | manual | none
    source: str = "none"  # alias of provider_source for Evidence compatibility
    confidence: str = "none"  # high | medium | low | none
    verification_status: str = VS_UNVERIFIED
    knowledge_hit: bool = False
    raw_ref: str = ""  # relative path to raw provider response
    phase: str = PHASE
    ok: bool = False
    error: str = ""
    # Future VIN Search / catalog matching (schema reserved)
    compatible: dict[str, Any] = field(default_factory=empty_compatible_parts)

    def known_fields(self) -> list[str]:
        out: list[str] = []
        if self.vin:
            out.append("vin")
        if self.brand:
            out.append("brand")
        if self.model:
            out.append("model")
        if self.year:
            out.append("year")
        if self.engine_code:
            out.append("engine_code")
        elif self.engine_desc:
            out.append("engine_desc")
        if self.transmission:
            out.append("transmission")
        if self.plant_country:
            out.append("plant_country")
        return out

    def identity_line(self) -> str:
        return " ".join(p for p in [self.year, self.brand, self.model] if p)

    def to_public_dict(self) -> dict[str, Any]:
        """Safe for Evidence / logs — VIN masked by default."""
        d = asdict(self)
        d["vin"] = self.vin_masked or mask_vin(self.vin)
        d["vin_full_redacted"] = True
        return d


@dataclass
class CustomerIntelligenceResult:
    snapshot: VehicleSnapshot
    known: list[str] = field(default_factory=list)
    do_not_ask: list[str] = field(default_factory=list)
    ask_list: list[str] = field(default_factory=list)
    ask_keys: list[str] = field(default_factory=list)
    next_action: str = "ask_missing_sales_fields"
    module: str = "SALES_DECISION"
    phase: str = PHASE

    def to_dict(self) -> dict[str, Any]:
        return {
            "phase": self.phase,
            "provider_chain": list(PROVIDER_CHAIN),
            "snapshot": self.snapshot.to_public_dict(),
            "known": self.known,
            "do_not_ask": self.do_not_ask,
            "ask_list": self.ask_list,
            "ask_keys": self.ask_keys,
            "next_action": self.next_action,
            "module": self.module,
        }


def _load_cache(root: Path | None = None) -> dict[str, Any]:
    path = vin_cache_path(root)
    if not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError):
        return {}


def _save_cache(cache: dict[str, Any], root: Path | None = None) -> None:
    path = vin_cache_path(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(cache, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _append_observation(row: dict[str, Any], root: Path | None = None) -> None:
    path = observations_path(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


def _save_raw(vin: str, provider: str, payload: Any, root: Path | None = None) -> str:
    h = vin_hash(vin)
    d = raw_dir(root)
    d.mkdir(parents=True, exist_ok=True)
    rel = f"data/vehicle_knowledge/raw/{provider}-{h}.json"
    abs_path = (root or workspace_root()) / rel
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    abs_path.write_text(
        json.dumps(
            {
                "at": datetime.now(timezone.utc).isoformat(),
                "provider_source": provider,
                "vin_masked": mask_vin(vin),
                "vin_hash": h,
                "phase": PHASE,
                "raw": payload,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return rel


def _base_snap(vin: str, **kwargs: Any) -> VehicleSnapshot:
    if "compatible" not in kwargs:
        kwargs["compatible"] = empty_compatible_parts()
    return VehicleSnapshot(
        vin=vin,
        vin_masked=kwargs.pop("vin_masked", mask_vin(vin) if vin else ""),
        vin_hash=kwargs.pop("vin_hash", vin_hash(vin) if vin else ""),
        phase=kwargs.pop("phase", PHASE),
        **kwargs,
    )


def _snapshot_from_cache_row(vin: str, row: dict[str, Any]) -> VehicleSnapshot:
    provider = str(row.get("provider_source") or row.get("source") or "asia_power_store")
    vs = str(row.get("verification_status") or VS_PROVIDER_REPORTED)
    # High-confidence store hits are treated as reusable knowledge
    if row.get("knowledge_trusted") or vs in {VS_VERIFIED, VS_MANUAL_REVIEWED}:
        vs = vs if vs != VS_PROVIDER_REPORTED else VS_VERIFIED
    return _base_snap(
        vin,
        brand=str(row.get("brand") or ""),
        model=str(row.get("model") or ""),
        year=str(row.get("year") or ""),
        engine_code=str(row.get("engine_code") or ""),
        engine_desc=str(row.get("engine_desc") or ""),
        transmission=str(row.get("transmission") or ""),
        plant_country=str(row.get("plant_country") or ""),
        provider_source=provider,
        source=provider,
        confidence=str(row.get("confidence") or "high"),
        verification_status=vs,
        knowledge_hit=True,
        raw_ref=str(row.get("raw_ref") or ""),
        ok=bool(row.get("brand") or row.get("model") or row.get("year")),
        compatible=row.get("compatible") if isinstance(row.get("compatible"), dict) else empty_compatible_parts(),
    )


def _nhtsa_flat_to_snapshot(vin: str, flat: dict[str, Any], *, raw_ref: str = "") -> VehicleSnapshot:
    def g(*keys: str) -> str:
        for k in keys:
            v = flat.get(k)
            if v is None:
                continue
            s = str(v).strip()
            if s and s.lower() not in {"null", "none", "not applicable", ""}:
                return s
        return ""

    error_code = g("ErrorCode")
    brand = g("Make")
    model = g("Model")
    year = g("ModelYear")
    engine_code = g("EngineModel")
    engine_desc = " ".join(
        x
        for x in [
            g("DisplacementL"),
            g("EngineCylinders") and f"{g('EngineCylinders')}cyl",
            g("FuelTypePrimary"),
        ]
        if x
    ).strip()
    transmission = g("TransmissionStyle", "TransmissionSpeeds")
    plant = g("PlantCountry")
    ok = bool(brand or model or year)
    confidence = (
        "high" if ok and (not error_code or error_code.startswith("0")) else ("medium" if ok else "none")
    )
    return _base_snap(
        vin,
        brand=brand,
        model=model,
        year=year,
        engine_code=engine_code,
        engine_desc=engine_desc,
        transmission=transmission,
        plant_country=plant,
        provider_source="nhtsa_vpic",
        source="nhtsa_vpic",
        confidence=confidence,
        verification_status=VS_PROVIDER_REPORTED,  # never auto-Verified
        knowledge_hit=False,
        raw_ref=raw_ref,
        ok=ok,
        error="" if ok else (error_code or "nhtsa_no_match"),
    )


def fetch_nhtsa(vin: str, *, timeout: float = 8.0, root: Path | None = None) -> VehicleSnapshot:
    """Phase 1 main external provider. Fields are Provider Reported only."""
    url = _NHTSA_URL.format(vin=urllib.parse.quote(vin))
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "AsiaPower-VehicleIntelligence/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        return _base_snap(
            vin,
            provider_source="nhtsa_vpic",
            source="nhtsa_vpic",
            confidence="none",
            verification_status=VS_UNVERIFIED,
            ok=False,
            error=str(exc)[:200],
        )

    raw_ref = _save_raw(vin, "nhtsa_vpic", payload, root)
    results = payload.get("Results") if isinstance(payload, dict) else None
    if not results or not isinstance(results, list):
        return _base_snap(
            vin,
            provider_source="nhtsa_vpic",
            source="nhtsa_vpic",
            confidence="none",
            verification_status=VS_UNVERIFIED,
            raw_ref=raw_ref,
            ok=False,
            error="nhtsa_empty",
        )
    flat = results[0] if isinstance(results[0], dict) else {}
    return _nhtsa_flat_to_snapshot(vin, flat, raw_ref=raw_ref)


def fetch_corgi_fallback(vin: str) -> VehicleSnapshot | None:
    """Phase 2+ offline fallback — NOT implemented in Phase 1."""
    return None


def write_knowledge(snapshot: VehicleSnapshot, root: Path | None = None, *, reason: str = "enrich") -> None:
    if not snapshot.vin or not snapshot.ok:
        return
    cache = _load_cache(root)
    cache[snapshot.vin] = {
        "vin_masked": snapshot.vin_masked or mask_vin(snapshot.vin),
        "vin_hash": snapshot.vin_hash or vin_hash(snapshot.vin),
        "brand": snapshot.brand,
        "model": snapshot.model,
        "year": snapshot.year,
        "engine_code": snapshot.engine_code,
        "engine_desc": snapshot.engine_desc,
        "transmission": snapshot.transmission,
        "plant_country": snapshot.plant_country,
        "provider_source": snapshot.provider_source or snapshot.source,
        "source": snapshot.provider_source or snapshot.source,
        "confidence": snapshot.confidence,
        "verification_status": snapshot.verification_status,
        "raw_ref": snapshot.raw_ref,
        "compatible": snapshot.compatible or empty_compatible_parts(),
        "phase": PHASE,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "reason": reason,
        # Only Manual Review / CEO promotion sets knowledge_trusted
        "knowledge_trusted": snapshot.verification_status in {VS_VERIFIED, VS_MANUAL_REVIEWED},
    }
    _save_cache(cache, root)
    _append_observation(
        {
            "at": datetime.now(timezone.utc).isoformat(),
            "type": "vin_knowledge_upsert",
            "vin_masked": mask_vin(snapshot.vin),
            "vin_hash": vin_hash(snapshot.vin),
            "provider_source": snapshot.provider_source,
            "verification_status": snapshot.verification_status,
            "confidence": snapshot.confidence,
            "brand": snapshot.brand,
            "model": snapshot.model,
            "year": snapshot.year,
            "phase": PHASE,
        },
        root,
    )


def lookup_knowledge(vin: str, root: Path | None = None) -> VehicleSnapshot | None:
    cache = _load_cache(root)
    row = cache.get(vin.upper()) or cache.get(vin)
    if not isinstance(row, dict):
        return None
    snap = _snapshot_from_cache_row(vin.upper(), row)
    return snap if snap.ok else None


def enrich_from_vin(
    text_or_vin: str,
    *,
    root: Path | None = None,
    allow_external: bool = True,
    timeout: float = 8.0,
) -> VehicleSnapshot:
    """
    Query chain:
      AsiaPower Store → NHTSA (Phase 1) → corgi (Phase 2+, stub) → Manual Review needed
    """
    vin = (
        extract_vin(text_or_vin)
        if len(text_or_vin.strip()) > 17 or " " in text_or_vin
        else text_or_vin.strip().upper()
    )
    if not vin:
        vin = extract_vin(text_or_vin)
    if not vin or len(vin) < 11:
        return _base_snap("", ok=False, error="no_vin", confidence="none", provider_source="none", source="none")

    vin = vin.upper()

    # 1) AsiaPower VIN Knowledge Store
    hit = lookup_knowledge(vin, root)
    if hit and (
        hit.verification_status in {VS_VERIFIED, VS_MANUAL_REVIEWED}
        or hit.knowledge_hit
        or hit.confidence in {"high", "medium"}
    ):
        # Reuse — do not re-call external provider
        return hit

    if not allow_external:
        return _base_snap(
            vin,
            ok=False,
            error="knowledge_miss",
            provider_source="asia_power_store",
            source="asia_power_store",
            verification_status=VS_UNVERIFIED,
        )

    # 2) NHTSA vPIC — Phase 1 main provider
    snap = fetch_nhtsa(vin, timeout=timeout, root=root)
    if snap.ok:
        write_knowledge(snap, root, reason="nhtsa_phase1_supplement")
        snap.knowledge_hit = False
        return snap

    # 3) corgi fallback — Phase 2+ (not implemented)
    corgi = fetch_corgi_fallback(vin)
    if corgi and corgi.ok:
        write_knowledge(corgi, root, reason="corgi_fallback")
        return corgi

    # 4) Manual Review needed
    snap.verification_status = VS_UNVERIFIED
    snap.error = snap.error or "needs_manual_review"
    return snap


def _message_has_quantity(text: str) -> bool:
    return bool(
        re.search(r"(\d+)\s*(?:pcs|units?|sets?|台|件)|(?:qty|quantity|数量)\s*[:：]?\s*\d+", text or "", re.I)
    )


def _message_has_port(text: str) -> bool:
    return bool(
        re.search(
            r"\b(port|tema|lagos|mombasa|durban|abidjan|harbour|harbor|港口)\b",
            text or "",
            re.I,
        )
    )


def _message_has_scope(text: str) -> bool:
    return bool(
        re.search(
            r"long\s*block|complete\s*engine|half[\s-]?cut|gearbox|变速箱|光机|总成",
            text or "",
            re.I,
        )
    )


def build_sales_decision(
    snapshot: VehicleSnapshot,
    customer_message: str = "",
) -> CustomerIntelligenceResult:
    known = snapshot.known_fields() if snapshot.ok else (["vin"] if snapshot.vin else [])
    do_not_ask = list(known)
    ask_keys: list[str] = []
    if not _message_has_scope(customer_message):
        ask_keys.append("product_scope")
    if not _message_has_quantity(customer_message):
        ask_keys.append("quantity")
    if not _message_has_port(customer_message):
        ask_keys.append("destination_port")

    ask_list = [_SALES_ASK_LABELS[k] for k in ask_keys if k in _SALES_ASK_LABELS]
    next_action = "ask_missing_sales_fields" if ask_list else "ready_for_quote_check"
    return CustomerIntelligenceResult(
        snapshot=snapshot,
        known=known,
        do_not_ask=do_not_ask,
        ask_list=ask_list,
        ask_keys=ask_keys,
        next_action=next_action,
    )


def build_whatsapp_reply(result: CustomerIntelligenceResult) -> str:
    snap = result.snapshot
    shown = snap.vin_masked or mask_vin(snap.vin) or "your VIN"
    lines: list[str] = []

    if snap.ok and snap.identity_line():
        lines.append(f"Got your VIN: {shown}")
        lines.append(f"Identified: {snap.identity_line()}")
        if snap.engine_code:
            lines.append(f"Engine code: {snap.engine_code}")
        elif snap.engine_desc:
            lines.append(f"Engine: {snap.engine_desc}")
        if snap.transmission:
            lines.append(f"Transmission: {snap.transmission}")
        if snap.verification_status == VS_PROVIDER_REPORTED:
            lines.append("(Provider reported — not yet AsiaPower-verified; we confirm before stock/price)")
        elif snap.knowledge_hit or snap.verification_status in {VS_VERIFIED, VS_MANUAL_REVIEWED}:
            lines.append("(AsiaPower vehicle knowledge — we still confirm before stock/price)")
        else:
            lines.append("(vehicle records — we still confirm before stock/price)")
    else:
        lines.append(f"Got your VIN: {shown}")
        lines.append("We're matching it in AsiaPower vehicle knowledge (full specs pending / may need manual review).")

    if result.ask_list:
        lines.append("")
        lines.append("To move to quotation, I only need:")
        for item in result.ask_list:
            lines.append(f"• {item}")
    else:
        lines.append("")
        lines.append("Thanks — we have the vehicle + sales basics. We'll check supply and advance to quotation.")

    lines.append("")
    lines.append("www.asia-power.com")
    return "\n".join(lines)


def enrich_and_decide(customer_message: str, *, root: Path | None = None) -> CustomerIntelligenceResult:
    snap = enrich_from_vin(customer_message, root=root)
    return build_sales_decision(snap, customer_message)
