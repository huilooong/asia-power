# AsiaPower V7 Marketplace — Brand Direction

**Scope:** Design direction for the V7 preview only. It evolves the existing AsiaPower navy-and-gold identity into a dependable B2B marketplace: buyers can discover credible sellers and buy with confidence, while AsiaPower remains the protected transaction and communication layer.

## 1. Brand foundation

**Positioning:** *The trusted marketplace for inspected used automotive assets and parts.*

**Promise:** The buyer can see who stands behind an item, understand its condition and price, reserve it securely, and transact through AsiaPower—not through an unprotected side channel.

**Brand pillars**

1. **Evidence before assurance** — photos, video, stock ID, condition notes, and clear commercial terms appear before any sales claim.
2. **Visible sellers, protected trade** — supplier reputation is public; buyer identity, direct contact data, and negotiation history are not.
3. **Marketplace accountability** — enquiries, deposits, fulfilment milestones, and support live in a traceable AsiaPower order record.
4. **Practical global trade** — plain English, export-aware information, and calm guidance for buyers across markets.

**Recommended V7 line:** `Verified stock. Protected trade.`

Use the current corporate line *Every Used Asset Has Value* in brand-story/footer contexts; use the V7 line in marketplace conversion surfaces.

## 2. Voice and trust language

The voice is **direct, evidence-led, calm, and internationally understandable**. It should feel like a capable export desk, not a classifieds site or a luxury-car advert.

| Do | Avoid |
|---|---|
| “Reserve this item with a deposit through AsiaPower.” | “Pay now before it’s gone!” |
| “Supplier response managed by AsiaPower.” | “Contact seller directly.” |
| “Condition reported by supplier; request an AsiaPower inspection.” | “Perfect condition” or unqualified “guaranteed.” |
| “Price: EXW Zhengzhou. Shipping quoted separately.” | Ambiguous all-in pricing or unexplained abbreviations. |
| “Your contact details are shared only with your approval.” | Language that implies buyer contact is automatically passed to sellers. |

### Trust-language controls

- Call an item **“Verified”** only when it has passed a documented V7 evidence/inspection rule. Otherwise use factual labels: `Photos received`, `Video available`, `Supplier-reported condition`, or `Inspection available`.
- A deposit button must state the amount/currency, what is reserved, reservation window, refund/cancellation rule, and who provides next-step support before payment confirmation.
- Never imply escrow, warranty, guaranteed availability, authentication, or payment protection unless the underlying policy and operation support it.
- Keep commercial nouns explicit: `item price`, `deposit`, `remaining balance`, `shipping`, `inspection`, and `export documents`.

## 3. Supplier visibility: reputation public, contacts private

### Public supplier identity

Show the supplier’s **approved trading display name** on listing cards and product pages. It gives buyers attribution and repeat-buy confidence without turning the platform into a lead directory.

**May be public**

- approved trading display name and logo/avatar
- supplier tier or verification state, only with a real, documented criteria set
- country/city or operating region at a coarse level
- years active on AsiaPower, completed-order band, response-time band, and rating/reviews only when reliable and policy-approved
- specialist categories, language coverage, and the supplier’s own non-contact shop/collection page

**Must stay private or platform-mediated**

- personal names, phone/WhatsApp, email, WeChat, social handles, street address, bank/payment details, external web links, QR codes
- buyer name, phone, email, delivery address, company details, and any original enquiry attachment containing them
- direct buyer–supplier message threads, negotiation history, and non-redacted RFQ text

**Interaction rule:** Supplier modules may link to `/suppliers/{public-slug}` and `View seller items`; every commercial action uses `Ask AsiaPower`, `Add to cart`, or `Reserve with deposit`—never `Contact supplier`.

### Supplier card — required content

Use one compact card component, with the same content hierarchy in product detail, cart, enquiry review, and supplier-shop pages:

1. Logo/avatar, approved trading name, location (country/region)
2. Status pill: `AsiaPower supplier` by default; `Verified supplier` only where criteria are met
3. One proof line: e.g. `Specialises in Toyota half-cuts` or `Video evidence available on selected stock`
4. Trust signals that are factual and available: `Since 2024`, `Typically responds within 4 business hours`, `12 fulfilled orders`
5. `View seller items` and `Ask AsiaPower about this seller` actions

Do not place the seller card above the item identity, price, stock ID, condition, or deposit terms. The buyer is purchasing an identified asset through AsiaPower, not merely discovering a trader.

## 4. Visual direction

Retain AsiaPower’s existing navy-and-gold equity; V7 should feel cleaner, more operational, and more legible than the legacy catalogue template.

```css
:root {
  --ap-navy-950: #07101F;       /* page/header foundation */
  --ap-navy-900: #0A1628;       /* existing primary brand */
  --ap-navy-800: #0F2140;       /* dark panels */
  --ap-gold-600: #B88712;       /* text/icon accent on light backgrounds */
  --ap-gold-500: #D4A017;       /* existing brand accent */
  --ap-gold-300: #F0C040;       /* sparing highlight only */
  --ap-slate-900: #172033;      /* body text */
  --ap-slate-600: #536176;      /* secondary text */
  --ap-slate-200: #E2E8F0;      /* borders */
  --ap-slate-50: #F7F9FC;       /* page field */
  --ap-white: #FFFFFF;
  --ap-success: #18794E;        /* confirmed/order state; never decorative */
  --ap-warning: #B45309;        /* limited/awaiting action */
  --ap-danger: #B42318;         /* payment/error state */
}
```

- **Primary conversion:** solid Navy 900 button on light surfaces; Gold is a premium accent, price highlight, or selected state—not the default button fill.
- **Data and trust:** white cards, restrained borders, 12px radius, strong image area, compact label/value pairs. Avoid glossy gradients, giant shadows, and badge overload.
- **Status:** every colour state must also use a text label and icon; do not encode payment, stock, or supplier status by colour alone.
- **Typography:** preserve `Barlow Condensed` for short category/vehicle headlines and `Inter` for interface and body copy. Use a Chinese sans-serif fallback for bilingual contexts. Never use a condensed typeface for payment terms, specification tables, or long condition text.
- **Images:** real stock imagery leads. Use consistent 4:3 listing crops and a 16:9 evidence/video treatment; never make generic vehicle photography appear to be inventory.

## 5. V7 page-system consistency rules

| Surface | Must always be present | Marketplace-specific priority |
|---|---|---|
| Home / category / search | One global header, search, account, cart, language, same footer | Discovery, filters, supplier identity at card level |
| Listing card | image, title, stock ID, condition, commercial price basis, seller display name | `Add to cart` and `Ask AsiaPower`; no exposed seller contacts |
| Product detail | global header/footer, evidence gallery, price/terms, supplier card, support path | sticky purchase panel: quantity/availability, cart, deposit, safeguarded enquiry |
| Cart / checkout | the same header and secure-payment framing | per-item deposit, clear totals and fee basis, terms before payment |
| Enquiry / RFQ | AsiaPower case ID, secure-message framing | preview the buyer-visible version; state that AsiaPower routes a protected brief to suitable suppliers |
| Supplier storefront / portal | shared logo, type, colors, nav, authenticated shell | public storefront shows reputation/inventory; portal enables editing without exposing buyer data |
| Account / order tracking | same header/footer and language choice | deposit/order timeline, AsiaPower as the named point of contact |

### Layout rules

- There is **one** public header and **one** public footer across every V7 public route. Login, supplier storefronts, cart, and checkout do not switch to a separate visual system.
- Desktop uses a centred content container (max 1280px); mobile keeps the same actions in a predictable bottom action bar on product and checkout pages.
- Header order: logo → marketplace categories → search → language → account → cart. Keep WhatsApp/help as an AsiaPower support channel, never as a supplier-channel substitute.
- Use a single product-status vocabulary everywhere: `Available`, `Reserved`, `Deposit pending`, `Sold`, `Inspection requested`. Do not alternate with legacy terms such as “In stock”/“Active” without a defined mapping.
- A price is inseparable from its basis (`EXW`, currency, tax/shipping inclusion) and availability timestamp. A deposit is inseparable from its reservation policy.

## 6. Protected enquiry experience

The buyer should feel helped, not hidden from the seller. Frame the workflow as a service advantage:

`Buyer enquiry → AsiaPower contact/privacy check → redacted commercial brief → matched supplier response → AsiaPower-managed offer/order`

**Buyer-facing microcopy:**

> AsiaPower sends a protected request to suitable suppliers. Your phone, email, and delivery details stay private unless you approve sharing them for fulfilment.

**Supplier-facing microcopy:**

> Respond through AsiaPower with availability, condition, lead time, and price. Buyer contact details are released only when required for an approved fulfilment step.

Place this explanation beside enquiry submission, in the enquiry status page, and in the supplier response workflow—not only in a legal footer.

## 7. Brand-protection checklist for V7 review

- Verify that every publicly visible seller name is an approved trading display name, with no contact escape hatch in copy, imagery, links, attachments, or QR codes.
- Audit uploaded photos and supplier-authored descriptions for phone numbers, watermarks, payment instructions, external links, and social handles before publishing.
- Confirm the same language setting and brand shell carry from public site through cart, checkout, account, and supplier portal.
- Review every “verified,” “secure,” “guaranteed,” deposit, and refund claim against a documented operational policy before launch.
- Test page templates at mobile and desktop widths: no legacy/eBay-style header, portal-only UI, or mixed-language action labels may appear.
- Treat the brand system as a release gate: a template that bypasses global navigation, typography, or privacy copy is not V7-ready.

**Brand Guardian decision:** V7 should make AsiaPower visibly accountable at every moment that money, identity, or trust changes hands. Supplier recognition builds marketplace depth; AsiaPower-owned checkout, enquiry routing, and language make that depth safe to transact through.
