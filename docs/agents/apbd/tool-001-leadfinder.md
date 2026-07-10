# APBD-TOOL-001 — Lead Finder MVP

**Task:** APBD-TOOL-001  
**Status:** Implemented  
**Date:** 2026-07-05

---

## Implemented Files

| Relative | Absolute |
|----------|----------|
| `agents/apbd/lead_finder.py` | `/Users/longhui/Desktop/AsiaPower/agents/apbd/lead_finder.py` |
| `agents/apbd/tools.py` | `/Users/longhui/Desktop/AsiaPower/agents/apbd/tools.py` (LeadFinderTool → live) |
| `agents/apbd/runtime.py` | `/Users/longhui/Desktop/AsiaPower/agents/apbd/runtime.py` (`/apbd leadfinder`) |
| `runtime/apbd/lead_dedup_keys.json` | `/Users/longhui/Desktop/AsiaPower/runtime/apbd/lead_dedup_keys.json` |

Reuses (no fork):

| Module | Role |
|--------|------|
| `customer_gateway/maps_prospect.py` | Google Places API + ethical Maps browser fallback, public website email scrape |

---

## CLI

```bash
python main.py "/apbd leadfinder"
```

Also runs inside full runtime when `LeadFinderTool` executes during `/apbd start`.

---

## Runtime Flow

```text
/apbd leadfinder
  ↓
Load Phase 1 markets (Ghana, Nigeria, Kenya, Tanzania, UAE)
  ↓
For each search query (cap: 12 queries / run default):
  search_places() → Places API, else Maps browser fallback
  ↓
Normalize lead fields + priority S/A/B
  ↓
Dedup (company + country + website|phone)
  ↓
Write runtime/apbd/YYYY-MM-DD/leads/
  daily-leads.json
  daily-leads.csv
  summary.json
```

No messaging, email send, or WhatsApp contact.

---

## Lead JSON Schema

Each lead in `daily-leads.json` → `leads[]`:

```json
{
  "company": "A1 Diesel Ltd.",
  "country": "Ghana",
  "city": "Accra",
  "website": "https://example.com",
  "public_email": "info@example.com",
  "public_phone": "+233 …",
  "business_type": "Auto parts dealer",
  "source_url": "https://www.google.com/maps/place/…",
  "value_reason": "Auto parts dealer in Ghana; public phone…; potential AsiaPower engine/parts buyer",
  "priority": "S",
  "lead_id": "a1b2c3d4e5f6g7h8i9j0",
  "discovered_at": "2026-07-05T06:00:00+00:00",
  "source": "google_maps",
  "place_id": "",
  "query": "engine importer Accra Ghana",
  "address": "…"
}
```

Missing public email or phone → `"Not published"` (never guessed).

Top-level JSON wrapper:

```json
{
  "generated_at": "ISO8601",
  "day": "YYYY-MM-DD",
  "tool": "LeadFinderTool",
  "phase": "1",
  "markets": ["Ghana", "Nigeria", "Kenya", "Tanzania", "UAE"],
  "lead_count": 42,
  "stats": { "queries_run": 12, "duplicates_skipped": 3, "api_quota_exhausted": false },
  "leads": [ … ]
}
```

---

## CSV Format

File: `daily-leads.csv`

| Column | Description |
|--------|-------------|
| Company | Business name |
| Country | Country |
| City | City |
| Website | Public website or empty |
| Public Email | Published email or `Not published` |
| Public Phone | Published phone/WhatsApp or `Not published` |
| Business Type | Inferred category |
| Source URL | Google Maps or website URL |
| Value Reason | Why valuable to AsiaPower |
| Priority | `S`, `A`, or `B` |

UTF-8, header row, one company per line.

---

## Duplicate Detection

Normalized keys stored in `runtime/apbd/lead_dedup_keys.json`:

| Field | Normalization |
|-------|---------------|
| Company name | Lowercase, strip suffixes (Ltd, LLC, …), collapse spaces |
| Website | Host only, no `www.` |
| Phone | Digits only |

Dedup key: `SHA256(company|country|web:host OR tel:digits OR city)[:20]`

---

## Known Limitations

| Limitation | Notes |
|------------|-------|
| Google Places daily quota | When exhausted, tool falls back to Maps browser (slower) |
| Browser fallback speed | ~60–90s per query; default cap 12 queries per run |
| LinkedIn / Facebook / directories | Not wired in TOOL-001 — Maps + public website email only |
| Email discovery | Only if published on public website (no guessing) |
| 100 leads/day target | Requires more queries or higher caps in a future sprint |
| Playwright required | Browser fallback needs Playwright Chromium installed |

---

## Lessons Learned

1. **Reuse maps_prospect** — AsiaPower already had Places API + browser fallback; APBD should not duplicate scraping infrastructure.
2. **Quota reality** — API quota can block a full run; browser fallback keeps the tool usable on the same day.
3. **Dedup before save** — Cross-run dedup file prevents re-adding the same Maps listing on daily runs.
4. **CSV + JSON** — CEO can open CSV in Excel immediately; JSON preserves full metadata for downstream APSales integration.
5. **Cap queries per run** — Unlimited queries would make `/apbd leadfinder` impractical (~30+ minutes).

---

## Future Improvements

| ID | Improvement |
|----|-------------|
| TOOL-001b | LinkedIn / Facebook public business page adapters |
| TOOL-001c | Trade directory ingest (public association lists) |
| TOOL-001d | Raise daily lead target with query scheduler + API quota budgeting |
| TOOL-001e | Push qualified S/A leads to APSales Opportunity pipeline (APSALES-102) |
| TOOL-001f | CEO approval gate before leads enter outreach queue |

---

## Runtime Output Tree

```text
runtime/apbd/
├── lead_dedup_keys.json
└── YYYY-MM-DD/
    └── leads/
        ├── daily-leads.json
        ├── daily-leads.csv
        └── summary.json
```

Example after successful run:

```text
runtime/apbd/
├── lead_dedup_keys.json
└── 2026-07-05/
    └── leads/
        ├── daily-leads.json
        ├── daily-leads.csv
        └── summary.json
```

---

## Report Path

| | Path |
|---|------|
| **Relative** | `docs/agents/apbd/tool-001-leadfinder.md` |
| **Absolute** | `/Users/longhui/Desktop/AsiaPower/docs/agents/apbd/tool-001-leadfinder.md` |
