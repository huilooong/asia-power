# APBD-TOOL-003 — Competitor Finder MVP

**Task:** APBD-TOOL-003  
**Status:** Implemented  
**Date:** 2026-07-05

---

## Implemented Files

| Relative | Absolute |
|----------|----------|
| `agents/apbd/competitor_finder.py` | `/Users/longhui/Desktop/AsiaPower/agents/apbd/competitor_finder.py` |
| `agents/apbd/tools.py` | `/Users/longhui/Desktop/AsiaPower/agents/apbd/tools.py` (`CompetitorTool` live) |
| `agents/apbd/runtime.py` | `/Users/longhui/Desktop/AsiaPower/agents/apbd/runtime.py` (`/apbd competitorfinder`) |
| `agents/apbd/safety.py` | `/Users/longhui/Desktop/AsiaPower/agents/apbd/safety.py` (browser UI blocked) |
| `agents/apbd/keyword_finder.py` | `/Users/longhui/Desktop/AsiaPower/agents/apbd/keyword_finder.py` (shared `PRIORITY_ENGINE_CODES`, catalog loader) |
| `runtime/apbd/competitor_dedup_keys.json` | `/Users/longhui/Desktop/AsiaPower/runtime/apbd/competitor_dedup_keys.json` |

Data inputs (read-only):

| Source | Purpose |
|--------|---------|
| `PUBLIC_COMPETITORS` | Curated public competitor profiles (marketplaces, exporters, regional suppliers) |
| `engines/*.html` | AsiaPower engine catalog codes for gap analysis |
| `PRIORITY_ENGINE_CODES` | High-value export engines to check on competitor sites |
| `PHASE1_MARKETS` | Ghana, Nigeria, Kenya, Tanzania, UAE — country landing gap checks |

---

## Runtime Flow

```text
/apbd competitorfinder
  ↓
assert_apbd_no_browser_ui()   # safety gate — no Playwright / browser UI
  ↓
Load catalog engine codes + priority list
  ↓
For each PUBLIC_COMPETITOR profile:
  HTTP fetch homepage (urllib only, 12s timeout, max 350KB)
  ↓
analyze_public_signals() — half-cut, FAQ, gearbox, VIN, export, country pages, engine codes
  ↓
Generate actionable opportunities (missing pages, weak content, EEAT, linking)
  ↓
Score priority S/A/B + dedup via opportunity_id hash
  ↓
Write runtime/apbd/YYYY-MM-DD/competitors/
  daily-competitors.json
  daily-competitors.csv
  summary.json
```

Also runs when `CompetitorTool` executes during `/apbd start` (scheduled `competitor_scan` task).

**Discovery mode:** `public_http_and_catalog_gap` — public HTTP only, no browser automation, no login scraping.

---

## CLI

```bash
python main.py "/apbd competitorfinder"
```

Example output (2026-07-05 run):

```text
CompetitorFinder complete — 119 opportunities
JSON: …/runtime/apbd/2026-07-05/competitors/daily-competitors.json
CSV: …/daily-competitors.csv
Summary: …/summary.json
Priority S/A/B: 99/13/7 | Competitors: 8 | HTTP fetch OK: 6
```

Runtime API (via `CompetitorTool`):

| Method | Returns |
|--------|---------|
| `run()` | Full outcome dict + output paths |
| `status()` | Last run status from tool state |
| `result()` | Parsed `daily-competitors.json` summary |

---

## JSON Schema

Each item in `daily-competitors.json` → `opportunities[]`:

```json
{
  "company": "Engine World USA",
  "website": "https://www.engineworldusa.com",
  "country": "USA",
  "business_focus": "Used engine exporter",
  "target_markets": "USA, Caribbean, Africa",
  "main_product_categories": "Used engines, Transmissions",
  "engine_brands_covered": "Toyota, Honda, Nissan, Ford",
  "missing_opportunities": "Competitor missing G4KD engine page",
  "weak_content": "Thin or absent G4KD content on public site",
  "keywords_we_can_target": "G4KD engine for sale; G4KD half cut; G4KD engine export; G4KD engine Ghana",
  "pages_we_should_build": "/engines/g4kd.html engine intelligence page",
  "business_opportunity": "AsiaPower can capture G4KD search traffic with verified inventory pages",
  "priority": "S",
  "opportunity_category": "missing_engine_page",
  "source_url": "https://www.engineworldusa.com/",
  "engine_code": "G4KD",
  "competitor_type": "used_engine_exporter",
  "opportunity_id": "a1b2c3d4e5f6g7h8i9j0",
  "discovered_at": "2026-07-05T06:20:21+00:00",
  "analysis_mode": "public_http_and_catalog_gap"
}
```

Wrapper:

```json
{
  "generated_at": "ISO8601",
  "day": "YYYY-MM-DD",
  "tool": "CompetitorTool",
  "opportunity_count": 119,
  "stats": {
    "ok": true,
    "discovery_mode": "public_http_and_catalog_gap",
    "browser_automation": false,
    "competitors_analyzed": 8,
    "fetch_success": 6,
    "fetch_failed": 2,
    "opportunities_found": 119,
    "duplicates_skipped": 0
  },
  "opportunities": [ … ]
}
```

`summary.json`:

```json
{
  "generated_at": "ISO8601",
  "day": "YYYY-MM-DD",
  "tool": "CompetitorTool",
  "opportunity_count": 119,
  "by_priority": { "S": 99, "A": 13, "B": 7 },
  "by_category": {
    "missing_engine_page": 98,
    "missing_gearbox_matching": 1,
    "no_faq": 2,
    "no_country_landing": 9,
    "no_half_cut_section": 2,
    "poor_internal_linking": 6,
    "weak_eeat": 1
  },
  "files": { "json": "daily-competitors.json", "csv": "daily-competitors.csv" },
  "stats": { … }
}
```

---

## CSV Schema

File: `daily-competitors.csv`

| Column | Description |
|--------|-------------|
| Company | Competitor name |
| Website | Public homepage URL |
| Country | HQ / primary market |
| Business Focus | e.g. used engine exporter, marketplace |
| Target Markets | Comma-separated regions |
| Main Product Categories | Product lines observed or from profile |
| Engine Brands Covered | Brands mentioned on site or profile |
| Missing Opportunities | Actionable gap headline |
| Weak Content | Supporting weakness detail |
| Keywords We Can Target | Semicolon-separated keyword phrases |
| Pages We Should Build | Suggested AsiaPower page / section |
| Business Opportunity | Why this gap matters for traffic/leads |
| Priority | `S`, `A`, or `B` |
| Opportunity Category | e.g. `missing_engine_page`, `no_half_cut_section` |
| Source URL | URL used for analysis |

---

## Runtime Directory Tree

```text
runtime/apbd/
├── competitor_dedup_keys.json
└── YYYY-MM-DD/
    └── competitors/
        ├── daily-competitors.json
        ├── daily-competitors.csv
        └── summary.json
```

Example (2026-07-05):

```text
runtime/apbd/
├── competitor_dedup_keys.json
└── 2026-07-05/
    └── competitors/
        ├── daily-competitors.json
        ├── daily-competitors.csv
        └── summary.json
```

---

## Competitor Scoring Logic

| Priority | Rule |
|----------|------|
| **S** | Missing priority engine page (`missing_engine_page` for top 12 `PRIORITY_ENGINE_CODES`); missing gearbox matching on exporter/half-cut sites; boosted from A→S when engine is in top-15 priority list and competitor type is exporter/marketplace/half-cut |
| **A** | No half-cut section, no FAQ, no country landing (Phase 1 markets), weak buyer guide, missing compatibility content |
| **B** | Weak EEAT (no VIN/export proof), poor internal linking |

Opportunity categories (actionable only):

| Category | Example output |
|----------|----------------|
| `missing_engine_page` | Competitor missing G4KD page |
| `no_half_cut_section` | No Half Cut section |
| `no_faq` | No FAQ / export buyer guide |
| `no_country_landing` | No Ghana country landing page |
| `weak_buyer_guide` | Weak engine buyer guide |
| `weak_eeat` | Weak VIN/stock/export proof |
| `missing_gearbox_matching` | Missing gearbox matching guidance |
| `poor_internal_linking` | Limited cross-linking between categories |
| `missing_compatibility` | Reserved in `_GAP_CHECKS` for future rule expansion |

Competitor types covered:

- `marketplace` — Alibaba, BE FORWARD, Jumia, Jiji
- `used_engine_exporter` — Engine World USA, SW Engines
- `half_cut_supplier` — Japan Partner
- `auto_parts_exporter` — Tokyo Motor Corporation

When HTTP fetch fails, profile-based fallback still emits at least one actionable opportunity (priority A).

---

## Known Limitations

| Limitation | Notes |
|------------|-------|
| Homepage-only fetch | Single public URL per competitor; no deep crawl |
| No login / paywall sites | Alibaba homepage only; supplier listings not scraped |
| Text signal heuristics | FAQ/half-cut/VIN detected by keyword presence, not DOM structure |
| No live SERP ranking | Opportunities inferred from gaps, not Google position data |
| Static competitor list | 8 curated profiles; expansion via `PUBLIC_COMPETITORS` config |
| Default cap 120 opportunities/run | Configurable via `max_opportunities` |
| Dedup persists cross-runs | Re-runs skip previously seen `opportunity_id` hashes |
| 2 fetch failures expected | Some sites block bots or timeout (profile fallback used) |

---

## Lessons Learned

1. **API-only HTTP is enough for MVP** — urllib homepage fetch + text heuristics surfaces real content gaps without Playwright.
2. **Catalog gap analysis scales** — Comparing competitor HTML against AsiaPower `engines/` codes produces high-volume S-priority opportunities.
3. **Mirror TOOL-001/002 output shape** — JSON + CSV + summary keeps CEO review workflow consistent.
4. **Safety gate mandatory** — `assert_apbd_no_browser_ui()` at discover entry prevents accidental browser launch regressions.
5. **Profile fallback required** — Bot-blocking sites still yield actionable profile-based opportunities when fetch fails.
6. **Dedup prevents rerun bloat** — Engine-page gaps repeat across competitors; hash dedup keeps daily files manageable.

---

## Future Extension Points

| ID | Extension |
|----|-----------|
| TOOL-003b | Add competitor profiles via YAML config (no code change) |
| TOOL-003c | SERP API read-only — verify keyword gaps with search results |
| TOOL-003d | Sitemap.xml fetch for deeper public page discovery (still no browser) |
| TOOL-003e | ContentPlannerTool consumes `daily-competitors.json` |
| TOOL-003f | KeywordFinder cross-link — boost keywords where competitor gaps align |
| TOOL-003g | WhatsApp inquiry log → validate which gaps drive real buyer questions |
| TOOL-003h | Automatic page generation / publishing — **explicitly not implemented** |

---

## Safety

CompetitorFinder **never** opens Chrome, Chromium, Safari, Playwright UI, or Google Maps. Public HTTP (`urllib`) and local catalog processing only.

---

## Report Path

| | Path |
|---|------|
| **Relative** | `docs/agents/apbd/tool-003-competitorfinder.md` |
| **Absolute** | `/Users/longhui/Desktop/AsiaPower/docs/agents/apbd/tool-003-competitorfinder.md` |
