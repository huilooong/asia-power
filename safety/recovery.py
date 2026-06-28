"""Backup and recovery for APCOO operational data."""

from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from safety.policy import BACKUP_DIRECTORIES

ROOT = Path(__file__).resolve().parent.parent
BACKUPS_ROOT = ROOT / "backups"


def reconfigure_backups_root(path: Path) -> None:
    global BACKUPS_ROOT
    BACKUPS_ROOT = path


def _timestamp_id() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d-%H%M%S")


def create_backup() -> Path:
    """Copy constitution/, memory/, runtime/, audit/ to backups/YYYY-MM-DD-HHMMSS/."""
    BACKUPS_ROOT.mkdir(parents=True, exist_ok=True)
    backup_id = _timestamp_id()
    dest = BACKUPS_ROOT / backup_id
    dest.mkdir(parents=True)

    manifest: dict = {
        "backup_id": backup_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "directories": [],
    }

    for name in BACKUP_DIRECTORIES:
        src = ROOT / name
        if src.is_dir():
            shutil.copytree(src, dest / name, dirs_exist_ok=True)
            manifest["directories"].append(name)

    (dest / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    from audit.logger import log_event
    log_event("backup_created", backup_id=backup_id, path=str(dest))

    return dest


def list_backups() -> list[dict]:
    """List available backups newest first."""
    if not BACKUPS_ROOT.is_dir():
        return []
    items: list[dict] = []
    for path in sorted(BACKUPS_ROOT.iterdir(), reverse=True):
        if not path.is_dir():
            continue
        manifest_path = path / "manifest.json"
        if manifest_path.is_file():
            try:
                data = json.loads(manifest_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                data = {"backup_id": path.name}
        else:
            data = {"backup_id": path.name}
        data["path"] = str(path)
        items.append(data)
    return items


def dry_run_restore(backup_id: str) -> str:
    """Preview what restore would do without writing."""
    backup_dir = BACKUPS_ROOT / backup_id
    if not backup_dir.is_dir():
        return f"Backup not found: {backup_id}"

    lines = [
        f"[DRY RUN] Restore preview for backup: {backup_id}",
        f"Source: {backup_dir}",
        "",
        "Would restore directories:",
    ]
    for name in BACKUP_DIRECTORIES:
        src = backup_dir / name
        if src.is_dir():
            file_count = sum(1 for _ in src.rglob("*") if _.is_file())
            lines.append(f"  - {name}/ → {ROOT / name} ({file_count} files)")
        else:
            lines.append(f"  - {name}/ (missing in backup, skip)")

    lines.extend([
        "",
        "No files written. To apply: python -m runtime.recovery restore "
        f"{backup_id} --confirm",
    ])
    return "\n".join(lines)


def restore_backup(backup_id: str, *, confirm: bool = False) -> str:
    """Restore from backup. Requires confirm=True after dry-run review."""
    if not confirm:
        return dry_run_restore(backup_id)

    backup_dir = BACKUPS_ROOT / backup_id
    if not backup_dir.is_dir():
        return f"Error: backup not found: {backup_id}"

    restored: list[str] = []
    for name in BACKUP_DIRECTORIES:
        src = backup_dir / name
        if not src.is_dir():
            continue
        dest = ROOT / name
        if dest.exists():
            shutil.rmtree(dest)
        shutil.copytree(src, dest)
        restored.append(name)

    from audit.logger import log_event
    log_event("backup_restored", backup_id=backup_id, directories=restored)

    return f"Restored backup {backup_id}: {', '.join(restored)}"
