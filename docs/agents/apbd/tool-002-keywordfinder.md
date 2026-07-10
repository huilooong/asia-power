# APBD-TOOL-002 — Keyword Finder MVP

**Task:** APBD-TOOL-002  
**Status:** Implemented  
**Date:** 2026-07-05

---

## Implemented Files

| Relative | Absolute |
|----------|----------|
| `agents/apbd/keyword_finder.py` | `/Users/longhui/Desktop/AsiaPower/agents/apbd/keyword_finder.py` |
| `agents/apbd/tools.py` | `/Users/longhui/Desktop/AsiaPower/agents/apbd/tools.py` (KeywordFinderTool live) |
| `agents/apbd/runtime.py` | `/Users/longhui/Desktop/AsiaPower/agents/apbd/runtime.py` (`/apbd keywordfinder`) |
| `agents/apbd/safety.py` | `/Users/longhui/Desktop/AsiaPower/agents/apbd/safety.py` (browser UI blocked) |
| `runtime/apbd/keyword_dedup_keys.json` | `/Users/longhui/Desktop/AsiaPower/runtime/apbd/keyword_dedup_keys.json` |

Data inputs (read-only):

| Source | Purpose |
|--------|---------|
| `engines/*.html` | Engine catalog slugs → codes |
| `PRIORITY_ENGINE_CODES` | Curated high-value export engines |
| `VEHICLE_ENGINE_PAIRS` | Model + engine replacement keywords |
| `PHASE1_COUNTRIES` | Ghana, Nigeria, Kenya, Tanzania, UAE |

---

## Runtime Flow

```text
/apbd keywordfinder
  ↓
assert_apbd_no_browser_ui()   # safety gate
  ↓
Load engine codes (catalog + priority list)
  ↓
Apply keyword templates (engine, half cut, gearbox, country, export, replacement, …)
  ↓
Score priority S/A/B + inquiry value
  ↓
Dedup via keyword_id hash
  ↓
Write runtime/apbd/YYYY-MM-DD/keywords/
  daily-keywords.json
  daily-keywords.csv
  summary.json
```

Also runs when `KeywordFinderTool` executes during `/apbd start`.

**Discovery mode:** `local_catalog_matrix` — no browser, no paid APIs, no Google Trends.

---

## CLI

```bash
python main.py "/apbd keywordfinder"
```

Example output:

```text
KeywordFinder complete — 400 keywords
JSON: …/runtime/apbd/2026-07-05/keywords/daily-keywords.json
CSV: …/daily-keywords.csv
Summary: …/summary.json
Priority S/A/B: 158/140/102
```

---

## JSON Schema

Each item in `daily-keywords.json` → `keywords[]`:

```json
{
  "keyword": "G4KD engine Ghana",
  "category": "engine_country",
  "search_intent": "commercial",
  "buyer_intent": "high",
  "suggested_page_type": "engine_detail",
  "business_value": "Geo-targeted engine demand in Ghana",
  "inquiry_value": "high",
  "priority": "S",
  "reason": "Country + engine combo for localized landing and ads",
  "engine_code": "G4KD",
  "country": "Ghana",
  "keyword_id": "a1b2c3d4e5f6g7h8i9j0",
  "discovered_at": "2026-07-05T06:20:00+00:00",
  "source": "local_catalog_matrix"
}
```

Wrapper:

```json
{
  "generated_at": "ISO8601",
  "day": "YYYY-MM-DD",
  "tool": "KeywordFinderTool",
  "keyword_count": 400,
  "stats": {
    "discovery_mode": "local_catalog_matrix",
    "engine_codes_used": 50,
    "browser_automation": false
  },
  "keywords": [ … ]
}
```

---

## CSV Schema

File: `daily-keywords.csv`

| Column | Description |
|--------|-------------|
| Keyword | Search phrase |
| Category | e.g. `engine_country`, `half_cut`, `engine_replacement` |
| Search Intent | `informational`, `commercial`, `transactional` |
| Buyer Intent | `high`, `medium`, `low` |
| Suggested Page Type | `engine_detail`, `half_cut_listing`, `gearbox_hub`, `contact_enquiry` |
| Business Value | Why AsiaPower should target this keyword |
| Inquiry Value | `high`, `medium`, `low` |
| Priority | `S`, `A`, or `B` |
| Reason | Scoring rationale |

---

## Runtime Directory Tree

```text
runtime/apbd/
├── keyword_dedup_keys.json
└── YYYY-MM-DD/
    └── keywords/
        ├── daily-keywords.json
        ├── daily-keywords.csv
        └── summary.json
```

Example:

```text
runtime/apbd/
├── keyword_dedup_keys.json
└── 2026-07-05/
    └── keywords/
        ├── daily-keywords.json
        ├── daily-keywords.csv
        └── summary.json
```

---

## Keyword Categories Generated

| Category | Example |
|----------|---------|
| `engine_code` | `G4KD engine` |
| `used_engine` | `G4KD engine for sale` |
| `half_cut` | `2TR-FE half cut` |
| `gearbox` | `QR25DE engine and gearbox` |
| `compatibility` | `G4KD engine compatibility` |
| `engine_export` | `QR25DE engine export` |
| `engine_country` | `G4KD engine Ghana` |
| `engine_import` | `G4KD engine importer Nigeria` |
| `engine_replacement` | `Toyota Hilux engine replacement` |
| `vehicle_engine` | `Toyota Hilux 2TR-FE engine` |
| `auto_parts_export` | `auto parts export to Kenya` |

---

## Known Limitations

| Limitation | Notes |
|------------|-------|
| No live search volume | Priority scored by rules, not Google Keyword Planner |
| No Google Trends / Search Console | Extension points only |
| Catalog-driven | Keywords limited to engines in `engines/` + curated list |
| Default cap 400 keywords/run | Configurable via `max_keywords` payload |
| Dedup persists cross-runs | Re-runs skip previously seen keyword hashes |
| English keywords only | Local-language variants deferred |

---

## Lessons Learned

1. **Local matrix first** — AsiaPower already owns engine catalog assets; keyword opportunities can be generated offline without scraping Google.
2. **Mirror LeadFinder structure** — Same output pattern (JSON + CSV + summary) keeps CEO workflow consistent.
3. **Safety by default** — KeywordFinder never touches Playwright; `assert_apbd_no_browser_ui()` enforced at entry.
4. **S-priority = transactional + geo** — Country + engine + export/sale intent maps to highest business value.
5. **Dedup essential** — Template expansion produces overlapping phrases; hash dedup prevents CSV bloat.

---

## Future Extension Points

| ID | Extension |
|----|-----------|
| TOOL-002b | Google Search Console query import (API, read-only) |
| TOOL-002c | Google Trends interest scoring (when approved) |
| TOOL-002d | WhatsApp/email enquiry log → boost `inquiry_value` |
| TOOL-002e | French/Arabic keyword variants for West Africa |
| TOOL-002f | Auto-map keywords → existing `engines/*.html` URLs |
| TOOL-002g | ContentPlannerTool consumes `daily-keywords.json` |

---

## Safety

KeywordFinder **never** opens Chrome, Chromium, Safari, Playwright UI, or Google Maps. Local processing and catalog reads only.

---

## Report Path

| | Path |
|---|------|
| **Relative** | `docs/agents/apbd/tool-002-keywordfinder.md` |
| **Absolute** | `/Users/longhui/Desktop/AsiaPower/docs/agents/apbd/tool-002-keywordfinder.md` |
