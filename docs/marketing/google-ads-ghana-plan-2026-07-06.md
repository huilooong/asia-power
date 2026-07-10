# Google Ads Ghana Keyword Plan — 2026-07-06

## Verdict

Start with **Search only**, Ghana only, high-intent keywords only. Do not start Performance Max yet. We need query control because the market has many misleading low-value searches such as engine oil, engine cover, mounts, sensors, filters and diagrams.

## What The Market Language Shows

- Ghana retail marketplaces use customer-language phrases like `Corolla 2009,2010,2011,2012,2013 engine`, `Corolla engine`, `Camry engine`, `I also have gearbox`, and Abossey Okai / Accra location words.
- Customers search by **model + year + part**, not only by engine code.
- Engine codes still matter for high-intent mechanics and importers, so they should run in separate ad groups with strict phrase/exact match.

## First Campaign Structure

### Campaign 1: `GH_Search_Engines_HighIntent`

Goal: engine replacement leads.

Ad groups:

- `Corolla 2009-2013 Engine`
- `Camry Engine`
- `Vitz Yaris Engine`
- `Hyundai Kia SUV Engine`
- `Hyundai Kia Sedan Engine`
- `Nissan Engine`
- `Honda Engine`

Landing page:

- Start with `https://asia-power.com/ghana.html`
- For engine-code terms, send to matching engine SEO page when it exists.

### Campaign 2: `GH_Search_Gearboxes_HighIntent`

Goal: gearbox and engine+gearbox bundle leads.

Ad groups:

- `Corolla Gearbox`
- `Camry Gearbox`
- `Hyundai Kia Gearbox`

Landing page:

- `https://asia-power.com/gearboxes/`

### Campaign 3: `GH_Search_HalfCuts_Import`

Goal: B2B importers, workshops and parts sellers.

Ad groups:

- `Half Cut Ghana`

Landing page:

- `https://asia-power.com/half-cuts/`

### Campaign 4: `GH_Search_Import_FromChina`

Goal: service-led leads for customers open to China sourcing.

Ad groups:

- `China To Ghana Auto Parts`

Landing page:

- `https://asia-power.com/ghana.html`

## Match Type Policy

Use only:

- Phrase match for first test.
- Exact match for expensive terms after Search Terms report confirms quality.

Avoid broad match until we have conversion data and negative keywords are proven.

## Initial Negative Keywords

Use account-level negatives:

```text
oil
engine oil
filter
oil filter
cover
engine cover
under cover
splash
shield
mount
seat
engine seat
gasket
plug
spark plug
sensor
coil
fan
shroud
manifold
belt
manual
pdf
diagram
specification
specs
how to
repair
training
school
job
jobs
salary
toy
game
free
cheap oil
new car
car rental
```

Campaign-specific negatives:

- For engine campaigns: add `gearbox` only if the ad group is pure engine. Keep `engine with gearbox` in bundle ad groups.
- For gearbox campaigns: add `oil`, `mount`, `sensor`, `manual`, `repair`.

## Starting Budget

Small controlled test:

- Daily total: GHS-equivalent of **$15-30/day** for 7 days.
- 70% to engine high-intent.
- 15% to gearbox.
- 10% to half-cuts.
- 5% to China-to-Ghana service terms.

Pause any ad group with clicks but no WhatsApp/form lead after enough spend to judge. First week goal is not scale; it is discovering which query wording produces real Ghana leads.

## Ad Copy Angles

### Engine Replacement

Headline ideas:

- Used Engines For Ghana
- Corolla / Camry Engines
- China Stock, Ghana Pickup
- Send Model & Year
- Engines With Gearbox

Description ideas:

- Browse real China stock. Send your car model, year and destination in Ghana. We check matching stock before quote.
- Engines, gearboxes and half-cuts from China. We handle sourcing, shipping and customs clearance.

### Half-Cuts

Headline ideas:

- Half-Cut Cars For Ghana
- Front Cuts From China
- Engines, Gearboxes, Half-Cuts

Description ideas:

- Real donor car photos before quote. Choose the part, we remove it, ship it and arrange Ghana pickup.

## Tracking Setup Needed Before Spend

Minimum:

- Google Ads conversion: WhatsApp click.
- Google Ads conversion: lead form submit.
- GA4 event names consistent with existing site.
- UTM naming:
  - `utm_source=google`
  - `utm_medium=cpc`
  - `utm_campaign=gh_search_engines_highintent`
  - `utm_content={adgroup}`
  - `utm_term={keyword}`

## Deliverable

Import-ready keyword draft:

`docs/marketing/google-ads-ghana-keywords-2026-07-06.csv`

