# AsiaPower Knowledge Identity Design

Date: 2026-07-04

Scope: engine knowledge records only. This document defines identity semantics; it does not modify any JSON schema, data file, or website page.

## 1. What Is `knowledge_id`?

`knowledge_id` is the internal stable primary key for one engine knowledge record.

It is for AsiaPower systems, not for public display. It should remain stable even if the website URL, SEO title, brand wording, or page slug changes.

Recommended format:

```text
engine:<normalized-engine-code>
```

Examples:

- `engine:g4kd`
- `engine:g4na`
- `engine:2az-fe`
- `engine:mr20de`
- `engine:om651-940`
- `engine:ea888-gen3`

Rules:

- Never include brand ownership in `knowledge_id`.
- Never include marketing page wording.
- Never change it after publication unless the record was fundamentally wrong and needs a migration.

## 2. What Is `engine_code`?

`engine_code` is the real-world engine model/code used by manufacturers, mechanics, suppliers, and buyers.

Examples:

- `G4KD`
- `G4NA`
- `2AZ-FE`
- `MR20DE`
- `OM651.940`
- `EA888 Gen3`

Rules:

- Preserve the market-recognized code as the display value.
- Do not force all codes into one punctuation style for display.
- Store aliases separately when the same code is written differently by buyers, suppliers, or import data.

## 3. What Is `slug`?

`slug` is the website URL-safe identifier.

It is for public routing and SEO, not for identity.

Examples:

- `g4kd-engine`
- `hyundai-kia-g4kd-engine`
- `toyota-2az-fe-engine`
- `nissan-mr20de-engine`
- `mercedes-om651-940-engine`
- `vw-ea888-gen3-engine`

Rules:

- `slug` may change for SEO or routing reasons.
- If a slug changes after publication, create redirects.
- Do not use `slug` as the internal database key.

## 4. Where Should `manufacturer` / `brand` Live?

Manufacturer and brand information should live in dedicated fields, not inside `knowledge_id`.

Recommended structure:

```json
{
  "knowledge_id": "engine:g4kd",
  "engine_code": "G4KD",
  "slug": "hyundai-kia-g4kd-engine",
  "manufacturer": {
    "primary": "Hyundai Motor Group",
    "brands": ["Hyundai", "Kia"]
  }
}
```

Reason:

- Engine identity is not the same as brand page ownership.
- One engine can appear under multiple brands.
- Brand naming changes over time; internal identity must not.

## 5. How To Represent Shared Hyundai/Kia Engines Like G4KD and G4NA

Hyundai/Kia shared engines should be represented as one engine knowledge record, not duplicated into separate Hyundai and Kia records.

Recommended:

```json
{
  "knowledge_id": "engine:g4kd",
  "engine_code": "G4KD",
  "slug": "hyundai-kia-g4kd-engine",
  "manufacturer": {
    "primary": "Hyundai Motor Group",
    "brands": ["Hyundai", "Kia"]
  },
  "applications": {
    "brands": ["Hyundai", "Kia"],
    "models": ["Hyundai ix35", "Hyundai Sonata", "Kia Sportage"]
  }
}
```

Do not create:

- `engine:hyundai-g4kd`
- `engine:kia-g4kd`

Those are brand-specific page routes or filters, not canonical engine identities.

If the website needs brand-specific landing pages, they should reference the same canonical `knowledge_id`.

Examples:

- `/engines/g4kd/` canonical engine page
- `/brands/hyundai/g4kd/` Hyundai-specific landing page, references `engine:g4kd`
- `/brands/kia/g4kd/` Kia-specific landing page, references `engine:g4kd`

## 6. How To Represent Complex Naming

### Toyota `2AZ-FE`

Recommended:

```json
{
  "knowledge_id": "engine:2az-fe",
  "engine_code": "2AZ-FE",
  "slug": "toyota-2az-fe-engine",
  "manufacturer": {
    "primary": "Toyota",
    "brands": ["Toyota", "Lexus"]
  },
  "aliases": ["2AZ", "2AZFE"]
}
```

Keep the hyphen in `engine_code`; normalize it only in `knowledge_id` and `slug`.

### Nissan `MR20DE`

Recommended:

```json
{
  "knowledge_id": "engine:mr20de",
  "engine_code": "MR20DE",
  "slug": "nissan-mr20de-engine",
  "manufacturer": {
    "primary": "Nissan",
    "brands": ["Nissan", "Renault Samsung"]
  },
  "aliases": ["MR20"]
}
```

The display code has no hyphen. Do not invent one.

### Mercedes `OM651.940`

Recommended:

```json
{
  "knowledge_id": "engine:om651-940",
  "engine_code": "OM651.940",
  "slug": "mercedes-om651-940-engine",
  "manufacturer": {
    "primary": "Mercedes-Benz",
    "brands": ["Mercedes-Benz"]
  },
  "family": "OM651",
  "variant": "940",
  "aliases": ["651.940", "OM651 940"]
}
```

Mercedes engine families often have sub-variants. Keep family and variant separate when possible.

### VW `EA888 Gen3`

Recommended:

```json
{
  "knowledge_id": "engine:ea888-gen3",
  "engine_code": "EA888 Gen3",
  "slug": "vw-ea888-gen3-engine",
  "manufacturer": {
    "primary": "Volkswagen Group",
    "brands": ["Volkswagen", "Audi", "Skoda", "Seat"]
  },
  "family": "EA888",
  "generation": "Gen3",
  "aliases": ["EA888.3", "EA888 third generation"]
}
```

Generation is part of the technical identity because EA888 generations differ materially.

## 7. Which Field Should Future URLs Use?

Future public URLs should use `slug`.

Recommended canonical URL pattern:

```text
/engines/{slug}/
```

Examples:

- `/engines/hyundai-kia-g4kd-engine/`
- `/engines/toyota-2az-fe-engine/`
- `/engines/nissan-mr20de-engine/`
- `/engines/mercedes-om651-940-engine/`
- `/engines/vw-ea888-gen3-engine/`

Internal APIs and data joins should use `knowledge_id`, not `slug`.

Recommended internal lookup:

```text
knowledge_id = engine:g4kd
```

Recommended buyer-facing display:

```text
engine_code = G4KD
```

## 8. Which Fields Can Change, And Which Must Never Change?

### Must Not Change

These are identity anchors:

- `knowledge_id`
- canonical meaning of `engine_code`

If either is wrong, create a migration note and redirect/alias path. Do not silently rewrite.

### Can Change With Redirects / Migration Notes

These affect routing or SEO:

- `slug`
- canonical URL
- title
- meta description
- primary keyword
- internal links

If `slug` changes, keep a redirect from the old URL.

### Can Change As Knowledge Improves

These are factual or operational data:

- `manufacturer.primary`
- `manufacturer.brands`
- applications
- compatible years
- official specs
- repair notes
- FAQ
- inventory
- half-cut availability
- shipping notes
- related products
- references
- confidence scores

Every change should update `source`, `last_update`, and `confidence`.

## Final Rule

Use fields for their own jobs:

- `knowledge_id`: internal stable identity
- `engine_code`: real engine code
- `slug`: URL and SEO route
- `manufacturer`: brand/factory ownership
- `aliases`: alternate spellings and buyer/import variations

Do not mix these together. That is the main rule that keeps AsiaPower's engine knowledge base stable as the website, inventory, and SEO strategy evolve.
