# APBD-UPGRADE-001 — Mission → Asset

**Upgrade:** UPGRADE-001  
**Date:** 2026-07-05  
**Status:** Implemented

---

## Why Mission → Asset Is Required

APBD v1 stopped at **tasks** (missions and content queue). A real employee delivers **work product**, not only instructions.

| Old flow | Problem |
|----------|---------|
| Traffic opportunity → Mission → Content queue → **Stop** | CEO must still write posts, pages, scripts, and outreach copy manually |

| New flow | Benefit |
|----------|---------|
| Mission → **Draft Asset** → Approval Queue → Execution Agent | CEO reviews ready-to-use drafts; approved assets can later be executed by Content / APSales agents |

**Rules unchanged:** no publish, send, deploy, comment, or post without CEO approval.

---

## New Runtime Flow

```text
LeadFinder → KeywordFinder → CompetitorFinder
  ↓
MissionPlanner
  ↓
Executive Plan
  ↓
Content Queue
  ↓
Draft Assets (NEW)
  ↓
Approval Queue (pending)
  ↓
Waiting Approval
  ↓
[Future] Execution Agent — only after CEO approves
```

---

## Draft Asset Schema

Each file under `draft_assets/{category}/{asset_id}.json`:

```json
{
  "asset_id": "3677c4ba3b554d96f2f3",
  "mission_id": "278f05fb1e9293ff185f",
  "mission_title": "Create Facebook content for Ghana mechanics",
  "mission_type": "social_content",
  "asset_type": "facebook_post_pack",
  "traffic_source": "Facebook",
  "target_audience": "Ghana mechanics and parts traders",
  "business_goal": "Facebook groups reach Ghana mechanics who can drive referral traffic to https://asia-power.com",
  "draft_content": {
    "facebook_post": "…",
    "image_prompt": "…",
    "hashtags": ["…"],
    "publishing_recommendation": "CEO approval before publish"
  },
  "recommended_cta": "WhatsApp inquiry (Ghana) — verify G4KD stock…",
  "recommended_destination_url": "https://asia-power.com/engines/g4kd.html",
  "approval_status": "pending",
  "generated_at": "2026-07-05T07:10:20+00:00",
  "category": "social",
  "constitution": "CONSTITUTION-001",
  "upgrade": "UPGRADE-001"
}
```

### Asset packs by mission type

| Mission type | Category folder | Asset pack includes |
|--------------|-----------------|---------------------|
| `landing_page` | `landing_pages/` | Brief, SEO outline, URL, schema, FAQ, internal links |
| `engine_guide` | `landing_pages/` | Guide title, SEO outline, FAQ, links |
| `social_content` | `social/` | Facebook post, image prompt, hashtags, publishing note |
| `youtube_topic` | `youtube/` | Title, script, thumbnail idea, description, tags, CTA |
| `linkedin_engagement` | `linkedin/` | Article title, body, CTA, publishing note |
| `forum_discovery` | `forums/` | Suggested forums, reply draft, reference links, CTA |
| `backlink_opportunity` / `partnership_traffic` | `backlinks/` | Target sites, outreach draft, value prop, landing page |
| `outreach` | `emails/` | Newsletter subject, preview, body, CTA |

---

## Approval Queue Design

**File:** `runtime/apbd/YYYY-MM-DD/draft_assets/approval_queue.json`

| Field | Purpose |
|-------|---------|
| `pending_count` | Assets awaiting CEO review |
| `approved_count` / `rejected_count` | Future status updates (manual or Execution Agent) |
| `items[]` | Index: asset_id, mission_id, traffic_source, file path, approval_status |

CEO workflow:

1. Open `approval_queue.json` or `draft-assets.csv`
2. Review individual asset JSON in category folder
3. Approve / reject (future: update `approval_status` field)
4. Approved assets only → Execution Agent (not implemented in this sprint)

---

## Runtime Directory Changes

```text
runtime/apbd/YYYY-MM-DD/
├── missions/
├── content_queue/
└── draft_assets/                    ← NEW
    ├── approval_queue.json          ← CEO approval index
    ├── all-draft-assets.json
    ├── draft-assets.csv
    ├── summary.json
    ├── landing_pages/
    │   └── {asset_id}.json
    ├── social/
    ├── youtube/
    ├── linkedin/
    ├── forums/
    ├── backlinks/
    └── emails/
```

Example run (2026-07-05): **18 missions → 18 draft assets → 18 pending approval**

---

## Files Modified

| Relative | Change |
|----------|--------|
| `agents/apbd/draft_assets.py` | **New** — asset generators, save, approval queue |
| `agents/apbd/mission_planner.py` | Calls draft asset generation after content queue |
| `agents/apbd/runner.py` | Logs draft assets in cycle output |
| `agents/apbd/runtime.py` | CLI output includes draft assets / approval queue |
| `constitution/roles/apbd.md` | Mission → Asset workflow documented |

---

## Report Path

| | Path |
|---|------|
| **Relative** | `docs/agents/apbd/upgrade-001-mission-to-asset.md` |
| **Absolute** | `/Users/longhui/Desktop/AsiaPower/docs/agents/apbd/upgrade-001-mission-to-asset.md` |
