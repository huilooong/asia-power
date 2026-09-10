#!/usr/bin/env python3
"""Headed Facebook login with www + Google redirect_uri rewrite.

Use on the CEO Mac (not a headless server):
  APSALES_SOCIAL_BROWSER_HEADLESS=0 .venv/bin/python3 scripts/apsales-facebook-google-verify.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except ModuleNotFoundError:
    pass

os.environ["APSALES_SOCIAL_BROWSER_HEADLESS"] = "0"


def main() -> int:
    from integrations.social_browser.platform_adapter import open_login_page

    result = open_login_page("facebook", wait_seconds=600)
    print(result)
    return 0 if result.get("logged_in") else 1


if __name__ == "__main__":
    raise SystemExit(main())
