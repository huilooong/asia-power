"""Registered business agents for AsiaPower AI OS."""

from __future__ import annotations

SUPPORTED_AGENTS = frozenset({"apcoo", "apsales"})

FUTURE_AGENTS = frozenset({
    "apinventory",
    "apmarketing",
    "apfinance",
    "apcustomer",
})

# Canonical id → display name (三国人物命名体系). Sursor(周瑜/公瑾) is a
# separate long-task worker outside this registry.
DISPLAY_NAMES = {
    "apcoo": "诸葛亮(孔明)",
    "apsales": "鲁肃(子敬)",
    "apinventory": "赵云(子龙)",
    "apfinance": "荀彧(文若)",
    "apmarketing": "庞统(士元)",
    "apcustomer": "简雍",
}

# Normalize external id → canonical agent id. Includes the 三国 display names so
# the CEO can address an agent by name (e.g. "孔明", "鲁肃") and resolve it.
_ALIASES = {
    "coo": "apcoo",
    "apsales": "apsales",
    "sales": "apsales",
    # 三国代号 → canonical id
    "诸葛亮": "apcoo", "孔明": "apcoo", "丞相": "apcoo",
    "鲁肃": "apsales", "子敬": "apsales",
    "赵云": "apinventory", "子龙": "apinventory",
    "荀彧": "apfinance", "文若": "apfinance",
    "庞统": "apmarketing", "士元": "apmarketing",
    "简雍": "apcustomer",
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
