"""APCOO operational backup CLI."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    sys.path.insert(0, str(ROOT))
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")

    from safety.recovery import create_backup

    dest = create_backup()
    print(f"Backup created: {dest}")
    print(f"Backup ID: {dest.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
