# APBD Browser Safety Fix

**Date:** 2026-07-05  
**Problem:** Google Maps / Chromium opening automatically on CEO Mac during APBD Lead Finder runs.

---

## Cause Found

**Primary trigger (APBD Lead Finder):**

| File | Lines | Issue |
|------|-------|-------|
| `agents/apbd/lead_finder.py` | ~285 | Called `search_places()` which falls back to browser when Places API returns empty |
| `customer_gateway/maps_prospect.py` | 355–378 | `search_maps_browser()` launches Playwright Chromium and navigates to `https://www.google.com/maps/search/...` |
| `customer_gateway/maps_prospect.py` | 364 (before fix) | `headless = search_cfg.get("browser_headless", False)` — **default visible browser** |
| `config/apsales_maps_prospect.yaml` | 90 (before fix) | `browser_headless: false` — explicitly requested visible browser |

When Google Places API quota was exhausted, Lead Finder invoked browser fallback → visible Google Maps windows opened on Mac.

---

## Files Checked

| File | Browser risk | Action |
|------|--------------|--------|
| `agents/apbd/lead_finder.py` | **Yes — root cause path** | **Changed** |
| `agents/apbd/tools.py` | Calls LeadFinder | **Changed** |
| `agents/apbd/runtime.py` | CLI only, no browser | No change |
| `agents/apbd/safety.py` | — | **Created** |
| `customer_gateway/maps_prospect.py` | Playwright + maps URL | **Changed** |
| `config/apsales_maps_prospect.yaml` | headless=false | **Changed** |
| `customer_gateway/africa_maps_prospect.py` | Playwright (defaults headless=true) | Checked — no change |
| `customer_gateway/whatsapp_browser_adapter.py` | Playwright WhatsApp | Checked — not APBD; unchanged |
| `integrations/social_browser/` | Playwright social login | Checked — not auto-run by APBD; unchanged |
| `inventory_core/qxb_pipeline.py` | `subprocess open` for review URLs | Checked — QXB only; unchanged |
| `main.py` | No browser | No change |
| Project grep: `webbrowser.open`, `selenium` | None in app code (venv only) | — |

---

## Files Changed

| File | Fix |
|------|-----|
| `agents/apbd/safety.py` | **New** — `APBD_BROWSER_UI_FORBIDDEN = True`; APBD tools must never open browser UI |
| `agents/apbd/lead_finder.py` | Use `search_places_api()` only; removed `search_places()` browser fallback |
| `agents/apbd/tools.py` | Call `assert_apbd_no_browser_ui()` before LeadFinder runs |
| `customer_gateway/maps_prospect.py` | Default `headless=True`; block visible browser unless `ASIAPOWER_ALLOW_VISIBLE_BROWSER=1` |
| `config/apsales_maps_prospect.yaml` | `browser_headless: true` |

---

## Fix Applied

1. **APBD Lead Finder = API only** — no Playwright, no Google Maps navigation from APBD code path.
2. **Safety module** — `agents/apbd/safety.py` documents and enforces the rule.
3. **Maps prospect hardening** — visible browser disabled by default repo-wide; CEO must set `ASIAPOWER_ALLOW_VISIBLE_BROWSER=1` to re-enable (not recommended).

APBD Runtime MVP and CLI commands (`/apbd start`, `/apbd leadfinder`, `/apbd status`, `/apbd stop`) are unchanged.

---

## How to Verify No Browser Opens

1. Watch the Mac screen — no Chrome/Chromium or Google Maps window should appear.
2. Run verification command (completes in seconds, no scraping):

```bash
cd /Users/longhui/Desktop/AsiaPower && .venv/bin/python3 -c "
from agents.apbd.safety import browser_ui_forbidden, APBD_DISCOVERY_MODE
from agents.apbd.lead_finder import discover_leads
assert browser_ui_forbidden() is True
assert APBD_DISCOVERY_MODE == 'places_api_only'
_, stats = discover_leads(max_queries=1, max_total=1)
assert stats.get('browser_fallback_disabled') is True
assert stats.get('discovery_mode') == 'places_api_only'
print('OK: APBD browser UI blocked, API-only mode')
"
```

3. Optional live CLI (API may return 0 leads if quota exhausted — browser must still not open):

```bash
python main.py "/apbd leadfinder"
```

Expected: command finishes with **no** new browser windows.

---

## Safety Rule (Permanent)

> **APBD tools must never open browser UI automatically.**  
> Lead discovery uses Google Places API only. Playwright / Google Maps browser fallback is disabled for all `agents/apbd/` code.

Override (not recommended): `ASIAPOWER_ALLOW_VISIBLE_BROWSER=1` affects non-APBD maps scripts only.
