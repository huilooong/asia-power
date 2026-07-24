"""Load Canada/industry market + keyword + scoring configs."""

from __future__ import annotations

from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
MARKETS_FILE = ROOT / "config" / "apbd_leads_markets.yaml"
KEYWORDS_FILE = ROOT / "config" / "apbd_lead_keywords.yaml"
SCORING_FILE = ROOT / "config" / "apbd_lead_scoring.yaml"


def _load_yaml(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise FileNotFoundError(f"Missing config: {path}")
    try:
        import yaml  # type: ignore
    except ImportError as exc:
        raise RuntimeError("PyYAML required to load lead configs") from exc
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict):
        raise ValueError(f"Invalid YAML root in {path}")
    return data


def load_markets() -> dict[str, Any]:
    return _load_yaml(MARKETS_FILE)


def load_keywords() -> dict[str, Any]:
    return _load_yaml(KEYWORDS_FILE)


def load_scoring() -> dict[str, Any]:
    return _load_yaml(SCORING_FILE)


def get_country(markets: dict[str, Any] | None = None, code: str = "CA") -> dict[str, Any]:
    cfg = markets or load_markets()
    want = (code or "CA").strip().upper()
    for c in cfg.get("countries") or []:
        if str(c.get("code") or "").upper() == want:
            return c
    raise KeyError(f"Country not in markets config: {want}")


def keyword_lists(pack_name: str | None = None) -> dict[str, list[str]]:
    kw = load_keywords()
    pack_id = pack_name or kw.get("default_pack") or "auto_repair"
    pack = (kw.get("packs") or {}).get(pack_id) or {}
    out: dict[str, list[str]] = {}
    for key, val in pack.items():
        if key == "label":
            continue
        if isinstance(val, list):
            out[key] = [str(x).strip() for x in val if str(x).strip()]
    return out


def brand_list() -> list[str]:
    kw = load_keywords()
    return [str(b) for b in (kw.get("brands") or []) if str(b).strip()]
