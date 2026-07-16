# AsiaPower V7 Marketplace Preview

**Status:** Preview only — no production changes, real payment, customer data, supplier access, or deployment.

## Deliverables

```text
docs/previews/v7-marketplace/
├── index.html                         # Clickable four-screen V7 concept
├── assets/v7-warehouse-hero.png       # AI-generated preview-only hero image
└── agent-outputs/
    ├── ux-architecture.md             # UX Architect workflow and data boundary handoff
    ├── ui-design-system.md             # UI Designer visual system handoff
    └── brand-direction.md              # Brand Guardian trust/identity handoff
```

## Preview locally

```bash
cd /Users/longhui/Desktop/AsiaPower
python3 -m http.server 8793
# http://127.0.0.1:8793/docs/previews/v7-marketplace/
```

## What the preview demonstrates

1. A unified public marketplace shell, product cards, visible verified supplier identity, cart, and clear price basis.
2. Cart/checkout where a deposit becomes payable only after supplier confirmation; payment is illustrative only.
3. An AsiaPower-managed inquiry relay that retains buyer privacy while sharing a redacted commercial brief with suppliers.
4. A supplier workspace for public storefront, product upload/edit/price management, and privacy-safe inquiry response.

## Required decisions before any build

- Deposit amount/eligibility, reservation expiry, cancellations and refunds.
- Merchant-of-record, payment provider/countries/currencies, tax and invoice ownership.
- Supplier verification criteria, public identity/rating policy and moderation rules.
- Redaction/review policy and approved conditions for releasing customer contact information.

## Validation

- Preview uses no real forms or payments.
- No customer data or supplier contact data is in the preview.
- Public and supplier views use one V7 visual system; supplier contacts and buyer PII are intentionally absent.
