"""Load YAML agent profiles."""

from pathlib import Path

import yaml

PROFILES_DIR = Path(__file__).resolve().parent.parent / "profiles"


def load_profile(agent_id: str) -> dict:
    """Load profile YAML for an agent id (e.g. coo, sales)."""
    path = PROFILES_DIR / f"{agent_id}.yaml"
    if not path.exists():
        return {}
    with path.open(encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return data


def list_profiles() -> list[str]:
    """Return available profile ids."""
    if not PROFILES_DIR.exists():
        return []
    return sorted(p.stem for p in PROFILES_DIR.glob("*.yaml"))
