# AsiaPower V7 Marketplace — UX Architecture

> **Preview-only architecture.** This is a design/implementation handoff for the V7 preview; it does not approve, change, or deploy production UI, payment, data models, or supplier access.

## Product model and navigation

V7 makes AsiaPower the merchant-of-record marketplace layer between verified buyers and suppliers. It must feel like one commerce product—not a public catalogue, a separate detail-template, and a disconnected portal.

**Primary navigation (public):** Shop inventory · Categories · How it works · Suppliers · Track order · Help. Header actions: language/currency, saved items, cart count, sign in. The same header, footer, brand tokens, and language state appear on catalog, product, supplier, checkout, and account pages. A light/dark/system setting is persistently available from header/account; the default is system preference.

**Commerce principle:** Add-to-cart expresses a purchase intent, while a deposit creates a time-boxed inventory reservation only after availability/pricing is confirmed. The UI must never call an item “sold” merely because it is in a cart.

## Screen map

```text
Public storefront
├─ Home / search
├─ Category or search results (filters, compare, save, quick-add)
├─ Product detail
│  ├─ verified media, condition, location, EXW price/price-on-request
│  ├─ supplier card (public name + verified badge; no direct contact controls)
│  ├─ add to cart / request quote / reserve with deposit
│  └─ questions & quote status (AsiaPower relay only)
├─ Supplier storefront
│  └─ profile, verification, catalogue, rating/fulfillment evidence; no private contact data
├─ Cart
├─ Checkout review → logistics / buyer details → order confirmation
├─ Deposit checkout → payment provider → reservation confirmation
└─ Buyer account
   ├─ orders & deposits, quote inbox, saved items, documents, messages
   └─ private contact/profile settings

Supplier workspace (authenticated + verified)
├─ Dashboard: pending availability, masked inquiries, orders, listing health
├─ Listings: list / create / draft / edit / price + stock history
├─ Listing editor: identity, specification, condition, media, price, shipping terms, preview
├─ Inquiry relay inbox: respond through AsiaPower with no buyer PII
├─ Availability & fulfilment: confirm / decline / prepare / handover milestones
├─ Storefront profile: display name, logo, story, facilities, verification evidence
└─ Payout / team / settings (restricted roles)

AsiaPower operations (internal only)
├─ supplier verification + storefront approval
├─ listing moderation + audit trail
├─ inquiry redaction/review + relay control
├─ order, reservation, refund and dispute console
└─ PII vault / consent / abuse monitoring
```

## Core interaction flows

### 1. Browse → cart → availability → deposit

1. Buyer sees price type and stock state: `Available`, `Confirming`, `Reserved until <time>`, or `Sold`; never infer availability from stale listing data.
2. Buyer chooses quantity/variant, sees an itemized estimate (unit price, deposit rate/amount, shipping and taxes marked *estimate* where relevant), and adds to cart. Cart items retain a price/availability timestamp.
3. At checkout the buyer supplies delivery/port requirements and accepts order/deposit terms. For request-price goods, CTA is `Request verified quote`, not `Pay`.
4. AsiaPower requests supplier confirmation within a defined SLA. If price or availability changes, buyer must explicitly accept the changed quote; the original cart total is not charged.
5. Once confirmed, buyer enters payment-provider checkout for the clearly labelled deposit. Payment webhooks, not browser redirects, create the reservation. The reservation shows expiry and next balance milestone.
6. Buyer receives an order timeline; supplier sees a fulfilment task but never the buyer’s direct contact information. Expired/failed payment returns stock to `Available` through a server-side state transition.

### 2. Buyer inquiry → masked relay → quote/order

1. Buyer submits a product-specific question or logistics request. Form labels say that AsiaPower will relay the request and that phone, email, social handles, URLs, and external-payment instructions cannot be exchanged.
2. Server stores the original message in the private PII vault; a redaction service creates a supplier-safe copy, detects circumvention attempts, and assigns a relay thread ID.
3. Supplier receives product context, requested quantity/destination requirements, a masked buyer label (for example `Buyer AP-4821`), and the redacted message. The supplier replies only in the relay UI.
4. Every reply is scanned/redacted before delivery. Any release of contact details is an Operations decision with recorded buyer consent and a business justification—not a supplier UI capability.
5. AsiaPower converts accepted supplier response into a buyer-facing quote. Buyer accepts/declines; acceptance follows the checkout/deposit flow above.

### 3. Supplier listing create/edit/publish

1. Verified supplier selects `New listing`; unverified suppliers may save drafts but cannot publish.
2. A guided editor requires category, product identity/VIN-or-serial where applicable, condition/defects, location, quantity, media, price model, currency, Incoterm, and availability window. It autosaves drafts and validates field-level requirements.
3. `Preview customer page` uses the shared V7 product-detail shell. Supplier sees moderation rules and a completeness score before submit.
4. First listings and material edits enter `Pending review`; permitted low-risk price/stock edits can be published directly only if policy allows. Price decreases/increases preserve an immutable price history and trigger cart/quote revalidation—not silent buyer changes.
5. Published updates invalidate affected cached availability and notify operations/buyers with open quotes; deletion is an archive/unlist action when there is transactional history.

## Permissions and data boundaries

| Capability / data | Buyer | Supplier | AsiaPower operations | Public |
|---|---|---|---|---|
| Product, condition, public supplier name | Read | Own listing write | Moderate | Read |
| Cart / order / payment details | Own only | Fulfilment minimum only | Read/manage with audit | Never |
| Buyer phone, email, company contacts | Own profile | **Never** | PII-vault access only | Never |
| Inquiry contents | Own original + relay copy | Redacted relay copy only | Original + redaction decision | Never |
| Supplier private contacts/payout/KYC | Never | Own | Restricted compliance/finance roles | Never |
| Listing creation/edit/price/detail | Never | Own verified storefront; team permissions | Moderate/override with audit | Read published only |
| Deposit/refund state | Own orders | Order status only | Finance/ops controlled | Never |

**Non-negotiable controls:** role-based access at API level (never client-only hiding); signed, short-lived media upload URLs; server-side currency/amount calculation; payment tokenization through provider; webhook idempotency; append-only price, status, moderation, and PII-release audits; rate limits and abuse reporting; default-deny access to masked data. Supplier display name is public, but phone/email/WhatsApp/social links, buyer direct identifiers, and external-payment instructions are absent from all public cards and relay messages.

## State contracts to settle before build

- **Listing:** `draft → pending_review → published → paused → archived`; availability `available | confirming | reserved | sold` is distinct from editorial status.
- **Cart line:** `active | needs_requote | unavailable | expired`; cart is not an inventory lock.
- **Quote:** `requested → supplier_response → buyer_review → accepted | declined | expired`.
- **Order/deposit:** `awaiting_confirmation → awaiting_deposit → deposit_paid → reserved → fulfilment → completed | cancelled | refunded`.
- A deposit amount, reservation duration, refund/cancellation policy, and which products are deposit-eligible require commercial/legal approval before production implementation.

## Interface foundation and accessibility

- One `MarketplaceShell` owns responsive header/footer, language/currency, cart badge, authenticated account switcher, theme selection, consent, and global support entry. Do not clone it per template.
- Use component contracts: `ProductCard`, `SupplierIdentity`, `PriceBlock`, `AvailabilityBadge`, `CartLine`, `QuoteTimeline`, `DepositBreakdown`, `RelayThread`, `ListingEditor`, and `ModerationStatus`. Keep public product data, private buyer data, and supplier workflow DTOs separate.
- Mobile-first: 16px edge padding; 2-column product/detail purchase panel at >=1024px; sticky mobile add-to-cart/deposit bar; checkout stepper retains values and exposes validation/fees before payment.
- Meet WCAG 2.1 AA: semantic forms, visible keyboard focus, keyboard-operable media/gallery/modals, live status updates for cart/quote/payment, no colour-only availability states, and clear error recovery. Financial CTAs include amount/currency and irreversible-action confirmation.

## Handoff priorities

1. **Foundation / preview shell:** establish V7 tokens, `MarketplaceShell`, route map, responsive system, theme/language persistence, and product/supplier-card contracts. This is the prerequisite for consistent homepage and subpages.
2. **Transactional safety:** define server-authoritative state machine, checkout quote revalidation, payment webhook flow, reservation expiry/release, audit logs, and refund handling. Obtain CEO/legal approval for terms and payment design before production.
3. **Privacy relay:** implement PII vault, redaction/classification, thread IDs, policy enforcement, operations review queue, and test attempts to bypass AsiaPower. No supplier inbox ships before this layer.
4. **Supplier tools:** guided listing editor, previews, media upload, draft/review/publish workflow, immutable price history, storefront profile, and granular supplier-team roles.
5. **Buyer experience:** catalog/search, detail pages, cart, quote comparison, checkout/deposit, and order timeline; then analytics for add-to-cart, quote acceptance, deposit conversion, supplier response SLA, and leakage attempts.

## Open decisions for CEO review

- Deposit percentage/minimum and whether it is refundable per item class.
- Merchant-of-record, tax/invoice ownership, supported currencies and payment countries.
- Supplier public-name policy, verification badge criteria, and whether ratings are displayed.
- Human review thresholds for redaction, pricing edits, and new supplier listings.
- Buyer/supplier terms that forbid off-platform deal diversion and define permitted contact release.

---

**Status:** Completed architecture handoff — preview only.  
**Added:** `docs/previews/v7-marketplace/agent-outputs/ux-architecture.md`  
**Modified:** none. **Deployment impact:** none. **Rollback:** delete this preview documentation only.  
**Validation:** reviewed against V7 cart, deposit, masked relay, supplier storefront/listing/edit/price/detail requirements; production implementation remains behind CEO review and release controls.
