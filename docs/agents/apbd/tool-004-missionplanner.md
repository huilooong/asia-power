# APBD-TOOL-004 — Mission Planner MVP

**Task:** APBD-TOOL-004  
**Status:** Implemented  
**Date:** 2026-07-05

---

## Implemented Files

| Relative | Absolute |
|----------|----------|
| `agents/apbd/mission_planner.py` | `/Users/longhui/Desktop/AsiaPower/agents/apbd/mission_planner.py` |
| `agents/apbd/tools.py` | `/Users/longhui/Desktop/AsiaPower/agents/apbd/tools.py` (`MissionPlannerTool` live) |
| `agents/apbd/runtime.py` | `/Users/longhui/Desktop/AsiaPower/agents/apbd/runtime.py` (`/apbd missionplanner`) |
| `agents/apbd/config.py` | `/Users/longhui/Desktop/AsiaPower/agents/apbd/config.py` (`mission_planner` task in default schedule) |
| `agents/apbd/safety.py` | `/Users/longhui/Desktop/AsiaPower/agents/apbd/safety.py` (browser UI blocked) |

Inputs (read-only, today's runtime):

| Source | Purpose |
|--------|---------|
| `runtime/apbd/YYYY-MM-DD/leads/daily-leads.json` | Qualified buyers by country |
| `runtime/apbd/YYYY-MM-DD/keywords/daily-keywords.json` | SEO demand by engine + country |
| `runtime/apbd/YYYY-MM-DD/competitors/daily-competitors.json` | Competitor content gaps |

---

## CLI

```bash
python main.py "/apbd missionplanner"
```

Prerequisite: run discovery tools first (same day):

```bash
python main.py "/apbd leadfinder"
python main.py "/apbd keywordfinder"
python main.py "/apbd competitorfinder"
python main.py "/apbd missionplanner"
```

Example output (2026-07-05):

```text
MissionPlanner complete — 43 missions
JSON: …/runtime/apbd/2026-07-05/missions/daily-missions.json
CSV: …/daily-missions.csv
Executive plan: …/executive-plan.md
Summary: …/summary.json
Priority S/A/B: 17/22/4 | Inputs: leads=2 kw=400 comp=119
```

---

## Runtime Flow

```text
/apbd missionplanner
  ↓
assert_apbd_no_browser_ui()   # safety gate
  ↓
Load today's tool outputs:
  leads/daily-leads.json
  keywords/daily-keywords.json
  competitors/daily-competitors.json
  ↓
Index keywords (engine+country), competitor gaps, leads by country
  ↓
Correlate signals → generate executable missions
  ↓
Score impact + assign priority S/A/B + owner
  ↓
Rank full mission list by impact_score
  ↓
Build CEO executive plan (top 5 **cross-channel** — never Google-only)
  ↓
Write runtime/apbd/YYYY-MM-DD/missions/
  daily-missions.json
  daily-missions.csv
  executive-plan.md
  summary.json
```

Also runs when `MissionPlannerTool` executes during `/apbd start` (after discovery tools).

**Analysis mode:** `traffic_first_correlate_leads_keywords_competitors` — local JSON only, no browser, no deployment.

**Constitution:** CONSTITUTION-001 Traffic First — optimize qualified traffic to asia-power.com across all ethical public channels, not Google/SEO alone.

---

## Mission JSON Schema

Each item in `daily-missions.json` → `missions[]`:

```json
{
  "mission_title": "Create Facebook content for Ghana mechanics",
  "mission_type": "social_content",
  "traffic_source": "Facebook",
  "business_reason": "Facebook groups reach Ghana mechanics who can drive referral traffic to https://asia-power.com",
  "supporting_evidence": ["Target G4KD demand in Ghana", "2 leads in market"],
  "expected_traffic": "high",
  "expected_leads": "medium",
  "expected_inquiries": "high",
  "estimated_difficulty": "medium",
  "estimated_time": "4-8 hours",
  "priority": "S",
  "owner": "Content Team",
  "recommended_next_step": "Draft Facebook post + group list for Ghana G4KD buyers linking to asia-power.com",
  "engine_code": "G4KD",
  "country": "Ghana",
  "impact_score": 18.5,
  "mission_id": "a1b2c3d4e5f6g7h8i9j0",
  "generated_at": "2026-07-05T07:00:00+00:00",
  "analysis_mode": "traffic_first_correlate_leads_keywords_competitors",
  "constitution": "CONSTITUTION-001",
  "destination": "https://asia-power.com",
  "primary_kpi": "Increase qualified traffic to AsiaPower",
  "secondary_kpi": "Increase qualified inquiries"
}
```

Wrapper:

```json
{
  "generated_at": "ISO8601",
  "day": "YYYY-MM-DD",
  "tool": "MissionPlannerTool",
  "mission_count": 43,
  "executive_plan_missions": 5,
  "stats": {
    "ok": true,
    "analysis_mode": "correlate_leads_keywords_competitors",
    "browser_automation": false,
    "inputs_present": { "leads": true, "keywords": true, "competitors": true },
    "leads_loaded": 2,
    "keywords_loaded": 400,
    "competitors_loaded": 119,
    "missions_generated": 43,
    "executive_plan_size": 5
  },
  "missions": [ … ],
  "executive_plan_path": "executive-plan.md"
}
```

---

## CSV Schema

File: `daily-missions.csv`

| Column | Description |
|--------|-------------|
| Mission Title | Executable action headline |
| Mission Type | e.g. `landing_page`, `outreach`, `catalog_expansion` |
| Business Reason | Why this mission matters today |
| Supporting Evidence | Semicolon-separated correlated signals |
| Expected Traffic | `high`, `medium`, `low` |
| Expected Leads | `high`, `medium`, `low` |
| Expected Inquiries | `high`, `medium`, `low` |
| Estimated Difficulty | `easy`, `medium`, `hard` |
| Estimated Time | e.g. `2-4 hours`, `4-8 hours` |
| Priority | `S`, `A`, or `B` |
| Owner | e.g. `Content Team`, `APSales`, `APInventory` |
| Recommended Next Step | Concrete first action |
| Engine Code | Related engine (if any) |
| Country | Related market (if any) |
| Impact Score | Numeric ranking score |

---

## Mission Scoring Logic

| Priority | Rule |
|----------|------|
| **S** | `impact_score >= 12` — immediate execution |
| **A** | `impact_score >= 7` — execute this week |
| **B** | `impact_score < 7` — backlog |

Impact score components:

| Signal | Weight |
|--------|--------|
| S-priority keywords (engine+country) | +3 base + 0.5 per keyword |
| Competitor missing-engine gaps | up to +6 (1.2 × gap count) |
| Qualified leads in market (S/A) | +2.5 per lead; outreach +4 bonus |
| Triple signal (keyword + gap + leads) | +5 bonus on landing pages |
| Competitor category gaps | +1 per gap (content missions) |

Expected traffic/leads/inquiries derived from impact score + lead count (not live analytics).

---

## Decision Logic

Mission types generated:

| Type | Trigger | Example |
|------|---------|---------|
| `landing_page` | S keywords + engine/country + competitor gap | Build G4KD Ghana Landing Page |
| `engine_guide` | Vehicle-engine keyword pairs + competitor weakness | Build Toyota Hilux Engine Guide |
| `outreach` | S/A leads in country | Target Ghana Engine Importers |
| `catalog_expansion` | High competitor missing-engine count | Expand G4KE Engine Coverage |
| `content_improvement` | Competitor category gaps (half-cut, EEAT, linking) | Improve Half Cut Content |
| `faq_creation` | Competitor `no_faq` gaps | Create FAQ for QR25DE |
| `country_expansion` | S keywords but no leads yet | Expand Nigeria Market Presence |

**CEO executive plan (top 5):** one best mission per traffic source first, then fill by impact — never a Google-only strategy when multi-channel missions exist.

See also: `docs/agents/apbd/constitution-001-traffic-first.md`

Correlation example:

```text
S keyword (1KD-FTV Ghana)
  + 8 competitor gaps on 1KD-FTV
  + 2 qualified Ghana leads
    ↓
Build 1KD-FTV Ghana Landing Page [S]
```

---

## Runtime Directory Tree

```text
runtime/apbd/
└── YYYY-MM-DD/
    ├── leads/
    ├── keywords/
    ├── competitors/
    └── missions/
        ├── daily-missions.json
        ├── daily-missions.csv
        ├── executive-plan.md
        └── summary.json
```

Example (2026-07-05):

```text
runtime/apbd/2026-07-05/missions/
├── daily-missions.json
├── daily-missions.csv
├── executive-plan.md
└── summary.json
```

---

## Known Limitations

| Limitation | Notes |
|------------|-------|
| Requires same-day tool outputs | Fails if leads/keywords/competitors not run |
| Rule-based impact estimates | No live traffic or conversion data |
| English missions only | Local-language actions deferred |
| No auto execution | Missions are decisions only — no publish/outreach/deploy |
| Lead volume sensitivity | Small lead samples can skew outreach ranking |
| Catalog missions still abundant | Full list includes many SEO tasks; CEO sees top 5 only |

---

## Lessons Learned

1. **Mission Planner is a reader, not a discoverer** — it only correlates existing APBD outputs.
2. **Triple-signal correlation produces the best missions** — keyword + competitor gap + leads = highest CEO value.
3. **Executive plan needs separate ranking** — raw impact score overweights catalog expansion; CEO view boosts outreach and landing pages.
4. **Mirror TOOL-001/002/003 output pattern** — JSON + CSV + summary + markdown executive brief.
5. **Safety by default** — no browser, no deployment, no automatic outreach; decisions only.

---

## Future Improvements

| ID | Extension |
|----|-----------|
| TOOL-004b | ContentPlannerTool consumes `daily-missions.json` |
| TOOL-004c | DistributionTool maps missions → channel actions |
| TOOL-004d | Inquiry log feedback loop → boost missions that drove past conversions |
| TOOL-004e | Google Search Console import → validate expected traffic |
| TOOL-004f | Mission completion tracking + daily delta |
| TOOL-004g | Automatic page generation / publishing — **explicitly not implemented** |
| TOOL-004h | Automatic outreach — **explicitly not implemented** |

---

## Safety

MissionPlanner **never** opens Chrome, Chromium, Safari, Playwright UI, or Google Maps. It reads local JSON/CSV outputs only. No deployment, publishing, outreach, or website modification.

---

## Report Path

| | Path |
|---|------|
| **Relative** | `docs/agents/apbd/tool-004-missionplanner.md` |
| **Absolute** | `/Users/longhui/Desktop/AsiaPower/docs/agents/apbd/tool-004-missionplanner.md` |
