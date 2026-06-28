"""APCOO recovery CLI — list and restore backups."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    sys.path.insert(0, str(ROOT))

    parser = argparse.ArgumentParser(description="APCOO backup recovery")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("list", help="List available backups")

    restore_p = sub.add_parser("restore", help="Restore a backup (dry-run by default)")
    restore_p.add_argument("backup_id", help="Backup folder name e.g. 2026-06-28-120000")
    restore_p.add_argument(
        "--confirm",
        action="store_true",
        help="Apply restore (required after reviewing dry-run)",
    )

    args = parser.parse_args()

    from safety.recovery import dry_run_restore, list_backups, restore_backup

    if args.command == "list":
        backups = list_backups()
        if not backups:
            print("No backups found under backups/")
            return 0
        print("Available backups (newest first):")
        for b in backups:
            bid = b.get("backup_id", "?")
            created = b.get("created_at", "?")
            dirs = ", ".join(b.get("directories", []))
            print(f"  - {bid}  ({created})  [{dirs}]")
        return 0

    if args.command == "restore":
        if args.confirm:
            print(restore_backup(args.backup_id, confirm=True))
        else:
            print(dry_run_restore(args.backup_id))
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
