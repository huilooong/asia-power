"""APBD safety rules — no automatic browser UI.

APBD tools must never open Chrome, Safari, Google Maps, or any visible browser window.
Lead discovery uses Google Places API only (no Playwright fallback).
"""

from __future__ import annotations

import os

# Frozen safety rule for APBD tooling
APBD_BROWSER_UI_FORBIDDEN = True

# Discovery mode label written to lead-finder stats
APBD_DISCOVERY_MODE = "places_api_only"


def browser_ui_forbidden() -> bool:
    """Return True when automatic browser UI is blocked (always for APBD)."""
    if APBD_BROWSER_UI_FORBIDDEN:
        return True
    return os.getenv("APBD_ALLOW_BROWSER_UI", "").strip() != "1"


def assert_apbd_no_browser_ui(caller: str) -> None:
    """Raise if browser UI would be allowed — guard for APBD tool authors."""
    if browser_ui_forbidden():
        return
    raise RuntimeError(f"{caller} attempted browser UI — blocked by APBD safety policy")
