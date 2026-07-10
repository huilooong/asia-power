# TASK-004 - Engine Page Factory V1

## Scope

Built the first static Engine Page Factory output from:

- `knowledge/schema/engine.schema.json`
- `knowledge/engines/g4kd.json`

No existing website pages or business logic were modified.

## New Files

1. `engines/g4kd.html`

   Static deployable engine knowledge page for the Hyundai/Kia G4KD engine.

   It includes:

   - H1
   - SEO title
   - Meta description
   - Breadcrumb
   - JSON-LD
   - Engine Overview
   - Applications
   - Specifications
   - Compatible Models
   - FAQ
   - Related Engines
   - Related Half Cuts
   - WhatsApp CTA
   - Inquiry Form
   - References

2. `docs/cto/task-004.md`

   Delivery note for TASK-004 and the intended batch-generation model.

## Page Factory Decisions

The page is static HTML because AsiaPower already has a large public website surface and the immediate requirement is direct deployment without changing site runtime code.

The page follows the existing AsiaPower public structure:

- `#site-topbar`
- `#site-header`
- `#site-footer`
- `#site-whatsapp`
- existing `css/fonts.css`
- existing `css/styles.css`
- existing `css/ebay-layout.css`
- existing contact form contract using `data-form="contact-enquiry"`

Official specifications that are not verified in `g4kd.json` are displayed as `Not verified yet` instead of being filled from memory or external assumptions.

Stock is described as requiring confirmation. The page does not present unconfirmed inventory as guaranteed available stock.

## Future Batch Generation

Engine Page Factory V1 can be expanded into a batch generator with this flow:

1. Load all JSON records from `knowledge/engines/`.
2. Validate each record against `knowledge/schema/engine.schema.json`.
3. Resolve identity fields:
   - `knowledge_id` as internal stable key when added.
   - `engine_code` as the real engine model.
   - `slug` as the public URL segment.
4. Render each record through one shared engine-page template.
5. Generate one static page per engine, for example:
   - `/engines/g4kd.html`
   - `/engines/g4na.html`
   - `/engines/2az-fe.html`
6. Include only fields with adequate source and confidence.
7. Render missing official data as `Not verified yet`.
8. Generate JSON-LD from the same validated source record.
9. Generate related engines and half-cuts from `related_products`, `inventory`, and `half_cuts`.
10. Keep inquiry form fields consistent with APSales lead intake.
11. Run a pre-deploy check for:
    - required sections
    - canonical URL
    - JSON-LD parseability
    - broken internal links
    - missing references
    - unverified stock language

## Recommended Next Step

Before scaling beyond G4KD, create a small generator script that renders from a template and fails if required sections or references are missing. That keeps future pages consistent and prevents manual drift across hundreds of engine codes.
