"""Load AsiaPower Constitution and role definitions for agent system context."""

from __future__ import annotations

from pathlib import Path

CONSTITUTION_DIR = Path(__file__).resolve().parent.parent / "constitution"
VERSION_FILE = CONSTITUTION_DIR / "VERSION"
ROLES_DIR = CONSTITUTION_DIR / "roles"

CONSTITUTION_FILES = (
    "00_company_constitution.md",
    "01_mission.md",
    "02_vision.md",
    "03_core_values.md",
    "04_decision_principles.md",
    "05_authority_matrix.md",
    "06_communication_standard.md",
    "07_company_culture.md",
    "99_founders_intent.md",
)

AGENT_ROLE_MAP = {
    "coo": "apcoo",
    "apcoo": "apcoo",
    "apsales": "apsales",
    "sales": "apsales",
    "apinventory": "apinventory",
    "inventory": "apinventory",
}


class ConstitutionError(FileNotFoundError):
    """Raised when a required constitution or role file is missing."""


def _read_required(path: Path, label: str) -> str:
    if not path.is_file():
        raise ConstitutionError(
            f"Missing {label}: {path}\n"
            f"Expected file under {CONSTITUTION_DIR}. "
            "Restore from repo or create the required markdown."
        )
    return path.read_text(encoding="utf-8").strip()


def load_constitution_version() -> str:
    """Return constitution version string (e.g. v1.0)."""
    return _read_required(VERSION_FILE, "constitution VERSION")


def load_constitution() -> str:
    """Load all company constitution markdown sections in order."""
    parts: list[str] = []
    for name in CONSTITUTION_FILES:
        parts.append(_read_required(CONSTITUTION_DIR / name, f"constitution file '{name}'"))
    return "\n\n---\n\n".join(parts)


def load_role(role_id: str) -> str:
    """Load a role definition from constitution/roles/."""
    role_id = (role_id or "").strip().lower()
    if not role_id:
        raise ConstitutionError("role_id is required (e.g. 'apcoo')")
    path = ROLES_DIR / f"{role_id}.md"
    return _read_required(path, f"role file for '{role_id}'")


def role_id_for_agent(agent_id: str) -> str | None:
    """Map routed agent id to constitution role id, if any."""
    return AGENT_ROLE_MAP.get((agent_id or "").strip().lower())


def build_constitution_context(role_id: str = "apcoo") -> str:
    """Combined constitution + role text for system prompt injection."""
    version = load_constitution_version()
    body = load_constitution()
    role_text = load_role(role_id)
    return (
        f"# AsiaPower Constitution ({version})\n\n"
        f"{body}\n\n"
        f"---\n\n"
        f"# Role: {role_id}\n\n"
        f"{role_text}"
    )


def build_constitution_context_for_agent(agent_id: str) -> str:
    """Constitution for any agent; append role section when mapped."""
    version = load_constitution_version()
    parts = [f"# AsiaPower Constitution ({version})\n\n{load_constitution()}"]
    role_id = role_id_for_agent(agent_id)
    if role_id:
        parts.append(f"# Role: {role_id}\n\n{load_role(role_id)}")
    return "\n\n---\n\n".join(parts)
