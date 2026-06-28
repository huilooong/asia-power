"""Registered business agents for AsiaPower AI OS."""

from __future__ import annotations

SUPPORTED_AGENTS = frozenset({"apcoo", "apsales"})

FUTURE_AGENTS = frozenset({
    "apinventory",
    "apmarketing",
    "apfinance",
    "apcustomer",
})

# Normalize external id → canonical agent id
_ALIASES = {
    "coo": "apcoo",
    "apsales": "apsales",
    "sales": "apsales",
}

# Canonical id → profile YAML stem
_PROFILE_MAP = {
    "apcoo": "coo",
    "apsales": "apsales",
}

# Canonical id → constitution role id
_ROLE_MAP = {
    "apcoo": "apcoo",
    "apsales": "apsales",
}


def normalize_agent_id(agent_id: str | None) -> str:
    """Return canonical agent id (default apcoo)."""
    aid = (agent_id or "apcoo").strip().lower()
    return _ALIASES.get(aid, aid)


def profile_id_for_agent(agent_id: str) -> str:
    """Map canonical agent id to profiles/{id}.yaml stem."""
    aid = normalize_agent_id(agent_id)
    return _PROFILE_MAP.get(aid, aid)


def role_id_for_agent(agent_id: str) -> str | None:
    """Map canonical agent id to constitution role file."""
    aid = normalize_agent_id(agent_id)
    return _ROLE_MAP.get(aid)


def is_supported_agent(agent_id: str) -> bool:
    return normalize_agent_id(agent_id) in SUPPORTED_AGENTS
