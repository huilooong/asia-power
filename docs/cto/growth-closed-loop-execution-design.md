# AsiaPower Growth Closed Loop Execution Design

Date: 2026-07-11
Owner: CEO / CTO Growth Review
Scope: SEO traffic growth, lead attribution, inquiry conversion, and daily operating loop

## 1. Executive Decision

AsiaPower should stop treating SEO as isolated page creation.

The next growth system must connect:

Inventory and half-cut donor data
→ Google landing pages
→ structured internal links
→ tracked inquiries
→ APSales handoff
→ page priority feedback
→ next content production.

The goal is not more pages by themselves. The goal is more qualified organic inquiries with measurable source pages.

## 2. Current Foundation

The current repository already contains the foundation needed for attribution:

- `js/lead-context.js` captures page URL, referrer, UTM parameters, product, brand, and inquiry subject.
- `js/main.js` submits contact-form lead metadata to `/api/leads/contact`.
- `js/half-cut-leads.js` submits half-cut lead metadata to `/api/leads/half-cut`.
- `server/lib/lead-context.js` normalizes page URL, referrer, UTM, product, and inquiry subject.
- `server/lib/contact-leads.js` stores lead source, intent, page URL, referrer, UTM, engine code, product, country, and reply channel.
- `server/lib/half-cut-notifications.js` already includes page context in lead notifications.
- Engine and donor pages now include stronger internal links and schema.

Conclusion: do not build a parallel attribution system. Reuse the existing lead pipeline.

## 3. Work Package Split

### Phase 1: Attribution Completion

Objective:
Make every inquiry attributable to a page, product, engine code, country, and CTA path.

Actions:

1. Standardize lead metadata across engine, donor, cluster, brand, country, and Africa hub pages.
2. Ensure every form submission includes:
   - `pageUrl`
   - `referrer`
   - `utm_source`
   - `utm_medium`
   - `utm_campaign`
   - `utm_content`
   - `utm_term`
   - `brand`
   - `product`
   - `engineCode`
   - `country`
   - `intent`
3. Ensure WhatsApp clicks include source-page context in the message text.
4. Add a non-invasive tracking rule: no customer contact is automated.

Success criteria:

- Every website lead in the admin lead inbox shows its origin page.
- APSales can see which page generated the lead.
- SEO pages can be ranked by actual inquiry output.

### Phase 2: Growth Page Expansion

Objective:
Generate more long-tail Google entry points from existing half-cut and engine data.

Priority page types:

1. Vehicle + engine + gearbox + half-cut pages
2. Engine code + country pages
3. Brand + half-cut engine pages
4. Country import pages
5. Cluster comparison pages

Priority query families:

- `G4NA half cut engine`
- `MR20DE half cut gearbox`
- `R20A3 engine half cut`
- `Toyota Camry 2AZ-FE engine Ghana`
- `Nissan Qashqai MR20DE engine Nigeria`
- `used engine and gearbox from China`
- `half cut engine supplier China`
- `custom dismantling car half cut export`

Success criteria:

- New pages are generated only when they have inventory signal, demand signal, or strategic country value.
- No unverified stock claims.
- No supplier privacy exposure.
- No full VIN exposure.

### Phase 3: Feedback Ranking

Objective:
Use actual lead and traffic evidence to decide what to build next.

Inputs:

- Lead count by page URL
- Lead count by engine code
- Lead country
- Lead intent
- Google Search Console query/page data when available
- Internal search/trending data
- Half-cut inventory freshness

Ranking logic:

1. Pages with inquiries get refreshed and expanded first.
2. Engine codes with stock but no page get generated next.
3. Pages with impressions but no clicks get title/meta improvement.
4. Pages with clicks but no inquiries get CTA and trust improvement.
5. Pages with neither impressions nor inquiries stay low priority unless inventory value is high.

Success criteria:

- Page production no longer depends on guesses.
- APSales lead quality influences SEO priorities.
- APInventory stock signals influence page priorities.

### Phase 4: Daily Growth Operation

Objective:
Make growth a daily operating rhythm, not a one-time build.

Daily workflow:

1. Review yesterday's new leads by source page.
2. Review pages with new impressions or clicks.
3. Identify the top 5 page opportunities.
4. Generate or improve the highest-value pages.
5. Update sitemap and internal links.
6. Validate live pages.
7. Hand off qualified lead context to APSales.

Daily output:

- Top 5 growth actions
- New/updated pages
- Leads by page
- High-performing engine codes
- Missing page opportunities
- APSales handoff summary

Success criteria:

- Every day produces either new qualified traffic assets or measurable conversion improvements.
- No reports are generated unless they drive an action.

## 4. CEO Operating Rules

1. Do not spend the $300 monthly budget on ads until attribution is working.
2. Do not publish pages that claim live stock without confirmation language.
3. Treat half-cut donor inventory as the main differentiated asset.
4. Use long-tail commercial intent instead of broad high-competition keywords.
5. Prioritize Ghana and Nigeria first, then Benin, Togo, Cameroon, Kenya, and UAE re-export.
6. Never automate WhatsApp, email, or public posting without human approval.
7. Do not create a parallel CRM; reuse the current lead store and APSales flow.

## 5. Implementation Roadmap

### Sprint A: Attribution Hardening

Deliverables:

- Verify all growth pages load `js/lead-context.js` or equivalent metadata capture.
- Ensure all lead forms submit page metadata.
- Add source-page context to WhatsApp CTA messages where missing.
- Add admin lead view fields if already available data is hidden.

Do not:

- Redesign APSales.
- Replace the lead store.
- Send outreach automatically.

### Sprint B: Page Factory Expansion

Deliverables:

- Generate the next batch of inventory-backed pages.
- Add cluster and country links automatically.
- Keep schema consistent: `Product`, `FAQPage`, `ItemList`, `BreadcrumbList`.
- Update sitemap and lastmod.

Do not:

- Invent official specs.
- Publish supplier names or private notes.
- Expose full VIN.

### Sprint C: Growth Dashboard

Deliverables:

- Read lead data by page URL.
- Summarize inquiries by engine code, country, and page type.
- Show top pages by inquiry value.
- Show pages needing SEO improvement.

Do not:

- Build a complex BI system before the first useful dashboard.
- Use vanity traffic metrics without inquiry context.

### Sprint D: Search Console Integration

Deliverables:

- Once Search Console property access is available, import page/query data.
- Join impressions/clicks to existing page and lead data.
- Create weekly page-priority recommendations.

Do not:

- Use deprecated Google/Bing ping endpoints as a substitute for Search Console.
- Use Indexing API for engine pages, because it is not meant for this content type.

## 6. Self-Test Checklist

- Reuses existing lead attribution files instead of creating a duplicate system.
- Keeps APCGO before APSales and does not let APCGO contact customers directly.
- Keeps APSales responsible for customer conversion.
- Keeps APInventory responsible for stock and donor confirmation.
- Does not propose automatic WhatsApp, email, or public posting.
- Does not require paid ads before attribution works.
- Keeps public pages safe: no private supplier data, no full VIN, no unconfirmed live-stock claims.
- Focuses every recommendation on traffic, leads, inquiries, or conversion.

## 7. CTO Decision

Approved next execution direction:

Start with Sprint A: Attribution Hardening.

Reason:

AsiaPower already has enough SEO page foundation to begin measuring which pages create business. Without attribution, more pages may increase traffic but will not tell the company what actually creates inquiries. With attribution, every future page batch can be ranked by ROI.

