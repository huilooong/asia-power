# APBD-CONSTITUTION-001 — Traffic First

**Amendment:** CONSTITUTION-001  
**Date:** 2026-07-05  
**Status:** Permanent constitutional update

---

## Summary

APBD's core objective changed from **Google traffic only** to **qualified traffic to AsiaPower** across all ethical public channels.

**Destination:** [https://asia-power.com](https://asia-power.com)

---

## Old Goal (Superseded)

Generate Google traffic.

## New Goal (Permanent)

**Increase qualified traffic to AsiaPower.**

Google is **only one** traffic source. Traffic acquisition must **never** be limited to SEO.

---

## KPIs

| Level | KPI |
|-------|-----|
| **Primary** | Increase qualified traffic to AsiaPower |
| **Secondary** | Increase qualified inquiries |

---

## Traffic Sources

Includes but is not limited to:

Google Search · Google Images · Google Business · Facebook · X · TikTok · YouTube · LinkedIn · Reddit · Industry Forums · Auto Communities · Industry Associations · Guest Posts · Backlinks · Partner Websites · WhatsApp sharing · Email newsletters · any other ethical public traffic source

---

## Decision Principle

Every APBD mission must answer:

> **Which traffic source can generate the highest business value for AsiaPower?**

Never generate a Google-only strategy. Always maximize **total qualified traffic** to asia-power.com.

---

## Files Updated

| Relative | Change |
|----------|--------|
| `constitution/roles/apbd.md` | New APBD role constitution |
| `agents/apbd/constitution.py` | Traffic First constants |
| `agents/apbd/mission_planner.py` | Multi-channel missions, executive plan, content queue |
| `docs/agents/apbd/overview.md` | Mission / KPI wording |
| `docs/agents/apbd/tool-004-missionplanner.md` | Traffic First decision logic |

---

## Mission Planner Changes

### New mission types

| Type | Traffic source | Example |
|------|----------------|---------|
| `social_content` | Facebook | Create Facebook content for Ghana mechanics |
| `forum_discovery` | Industry Forums | Find automotive forums discussing QR25DE |
| `youtube_topic` | YouTube | Find YouTube topics with buyer intent |
| `linkedin_engagement` | LinkedIn | Discover LinkedIn discussions worth participating in |
| `backlink_opportunity` | Backlinks | Find backlink opportunities from industry websites |
| `partnership_traffic` | Partner Websites | Identify partnerships capable of driving traffic |

Existing types (`landing_page`, `engine_guide`, `outreach`, etc.) now include explicit `traffic_source` field.

### Executive plan

- Top 5 missions selected **across traffic channels** (one best mission per source first)
- Plan header lists traffic channels included
- Never Google-only top 5 when multi-channel missions exist

### Content queue — new fields

Each task now includes:

- Traffic Source
- Target Audience
- Distribution Recommendation
- Expected Business Value
- Expected Traffic
- Expected Inquiry Value

---

## Rules (unchanged)

- No automatic posting
- No automatic outreach
- No browser automation
- No deployment or website modification

Decision logic only — human approval required for all external actions.

---

## Report Path

| | Path |
|---|------|
| **Relative** | `docs/agents/apbd/constitution-001-traffic-first.md` |
| **Absolute** | `/Users/longhui/Desktop/AsiaPower/docs/agents/apbd/constitution-001-traffic-first.md` |
