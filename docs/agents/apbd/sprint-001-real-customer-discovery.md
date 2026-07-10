# APBD-SPRINT-001 — Real Customer Discovery

**Sprint:** SPRINT-001  
**Date:** 2026-07-05  
**KPI:** Qualified companies in `outreach_queue` today

---

## Public Data Sources Connected

| Source | Method | Status (2026-07-05 run) |
|--------|--------|---------------------------|
| **Google Maps** | Google Places API (New) | **Active — 46 real companies** |
| **OpenStreetMap** | Nominatim public API | Connected (no additional matches this run) |
| **Yellow Pages** | Public directory HTTP | Connected (Ghana/Nigeria/Kenya domains) |
| **Europages** | Public company directory HTTP | Connected (signature fixed post-run) |

All discovery uses public HTTP/API only. No browser UI. No mock or demo data.

Supported countries: Ghana, Nigeria, Kenya, Tanzania, UAE.

---

## Number of Real Companies Discovered

| Metric | Count |
|--------|------:|
| **Qualified companies in outreach_queue** | **46** |
| Outreach drafts pending CEO approval | 46 |
| Duplicates skipped (dedup) | 12 |
| Queries run | 29 |

### By country

| Country | Companies |
|---------|----------:|
| Ghana | 8 |
| Nigeria | 12 |
| Kenya | 10 |
| Tanzania | 7 |
| UAE | 9 |

Example real companies (Google Maps public listings): auto parts importers, wholesalers, dismantlers, fleet workshops across Accra, Lagos, Nairobi, Dar es Salaam, Dubai.

Each record includes: company name, country, city, website/phone where publicly listed, business type, main products, match reason, company page URL (Maps/listing), email draft, WhatsApp draft, short intro, suggested asia-power.com landing page, CTA.

**No automatic send.** All items `approval_status: pending`.

---

## Outreach Queue Location

| | Path |
|---|------|
| **Relative** | `runtime/apbd/2026-07-05/outreach_queue/` |
| **Absolute** | `/Users/longhui/Desktop/AsiaPower/runtime/apbd/2026-07-05/outreach_queue/` |

| File | Purpose |
|------|---------|
| `outreach-queue.json` | All companies + full outreach drafts |
| `outreach-queue.csv` | CEO review spreadsheet |
| `summary.json` | KPI counts by country / source |
| `{outreach_id}.json` | Individual company outreach pack |

Leads (raw discovery): `runtime/apbd/2026-07-05/leads/daily-leads.json`

---

## Runtime Flow (SPRINT-001)

```text
Discover company (Google Maps + public directories)
  ↓
Collect public contact (phone, website, email if listed)
  ↓
Generate outreach draft (email + WhatsApp + intro + landing page + CTA)
  ↓
Save outreach_queue/ (pending approval)
  ↓
Continue next company
```

Triggered by: `python main.py "/apbd leadfinder"` or APBD Runner cycle step 1.

---

## Report Path

| | Path |
|---|------|
| **Relative** | `docs/agents/apbd/sprint-001-real-customer-discovery.md` |
| **Absolute** | `/Users/longhui/Desktop/AsiaPower/docs/agents/apbd/sprint-001-real-customer-discovery.md` |
