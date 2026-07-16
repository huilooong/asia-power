# AsiaPower V7 Marketplace — UI Design System & Screen Direction

**Role:** UI Designer (Agency Agents)  
**Status:** preview-ready visual handoff, not production UI  
**Scope:** public marketplace, PDP, cart/deposit checkout, and supplier workspace  
**Design objective:** make AsiaPower feel like a trusted cross-border automotive marketplace: buyers can shop and reserve inventory with confidence, while suppliers remain visible as verified merchants without gaining direct access to buyer contact data.

## 1. Visual point of view

V7 should be recognisably one product—not a marketing homepage beside an unrelated catalog and portal. The visual language is **industrial confidence, not generic SaaS**: warm off-white surfaces, ink-blue navigation, cobalt actions, strong vehicle imagery, and an orange reservation accent. It should be calm enough for expensive B2B purchases, yet familiar enough that a buyer immediately understands search, cart, checkout, order status, and merchant identity.

### Brand principles

1. **Inventory is the hero.** Large, consistent imagery and plain-language vehicle condition signals come before decorative marketing.
2. **Price and availability are decision tools.** Keep them close to the buying action, never hidden in an inquiry form.
3. **AsiaPower is visibly the transaction layer.** Supplier storefront identity is present; contact exchange is not. Trust is attributed to AsiaPower through escrow/deposit, vetted-supplier badges, and managed messaging.
4. **Operational screens are quieter.** Supplier tools optimize clarity, density, and confidence over marketing spectacle.

## 2. Design foundations

### 2.1 Design tokens

```css
:root {
  /* Brand and action */
  --ap-ink-950: #071827;        /* global nav / strongest headings */
  --ap-ink-800: #123047;
  --ap-blue-700: #0757B8;       /* primary action; 7.0:1 on white */
  --ap-blue-600: #0A6BD9;
  --ap-blue-100: #E6F1FF;
  --ap-blue-50: #F3F8FF;
  --ap-reserve-700: #B94700;    /* deposit / urgency, AA on white */
  --ap-reserve-600: #D25A00;
  --ap-reserve-100: #FFF0E5;

  /* Semantics */
  --ap-success-700: #087443;
  --ap-success-100: #DCF7E7;
  --ap-warning-800: #8A5100;
  --ap-warning-100: #FFF3D6;
  --ap-danger-700: #B42318;
  --ap-danger-100: #FEE4E2;
  --ap-info-700: #0757B8;

  /* Neutrals */
  --ap-canvas: #F6F7F8;
  --ap-surface: #FFFFFF;
  --ap-surface-subtle: #F2F4F6;
  --ap-border: #D6DCE2;
  --ap-border-strong: #AAB7C2;
  --ap-text: #12212D;           /* 15.6:1 on white */
  --ap-text-muted: #526472;     /* 5.7:1 on white */
  --ap-text-disabled: #7C8A96;

  /* Type */
  --ap-font-sans: Inter, "Noto Sans", Arial, sans-serif;
  --ap-font-display: "Barlow Condensed", Inter, "Noto Sans", Arial, sans-serif;
  --ap-text-xs: 12px;
  --ap-text-sm: 14px;
  --ap-text-md: 16px;
  --ap-text-lg: 18px;
  --ap-text-xl: 24px;
  --ap-text-2xl: 32px;
  --ap-text-3xl: clamp(38px, 4vw, 56px);

  /* Shape, depth, rhythm */
  --ap-radius-sm: 8px;
  --ap-radius-md: 12px;
  --ap-radius-lg: 18px;
  --ap-radius-pill: 999px;
  --ap-space-1: 4px; --ap-space-2: 8px; --ap-space-3: 12px;
  --ap-space-4: 16px; --ap-space-5: 20px; --ap-space-6: 24px;
  --ap-space-8: 32px; --ap-space-10: 40px; --ap-space-12: 48px;
  --ap-shadow-1: 0 1px 2px rgb(7 24 39 / 8%);
  --ap-shadow-2: 0 12px 28px rgb(7 24 39 / 12%);
  --ap-focus: 0 0 0 3px #B8D8FF, 0 0 0 5px #0757B8;
  --ap-motion-fast: 150ms ease-out;
  --ap-motion-standard: 220ms ease-out;
}
```

Use `--ap-ink-950` only for high-confidence brand moments (top nav, supplier sidebar, dark hero), not as the all-page background. Use the reserve orange **only** for deposits/reservations and time-sensitive status; it must not compete with generic CTAs.

### 2.2 Typography

Use Inter or the existing site sans for all functional content; load a variable version with Latin, Arabic, and CJK fallback coverage. `Barlow Condensed` is optional, headline-only, and never for tabular data, prices, or translations.

| Role | Desktop specification | Use |
|---|---:|---|
| Display | 56/60, 700 | homepage campaign headline only |
| H1 | 32/40, 700 | catalog, vehicle and checkout titles |
| H2 | 24/32, 700 | sections, supplier dashboard headings |
| H3 | 18/26, 650 | cards and panels |
| Body | 16/24, 400 | primary explanatory copy |
| UI / table | 14/20, 500 | controls, metadata, dense supplier tables |
| Label | 12/16, 700, 0.04em | uppercase or sentence-case metadata only |

Price uses tabular numerals (`font-variant-numeric: tabular-nums`) and semibold 24px on the PDP. Do not over-capitalize translated text.

### 2.3 Grid and responsive behavior

* Max content width: **1440px**; public pages use 24px gutters at desktop, 16px on mobile.
* Desktop: 12 columns, 24px gutter. Tablet: 8 columns. Mobile: one fluid column.
* Public catalog: filter rail 280px + 3-card grid at 1280px; at 1024px, 240px + 2 cards; below 768px filters become a bottom sheet and cards become one column.
* Supplier workspace: fixed 248px sidebar at 1024px+, collapsible icon rail at 768–1023px, slide-over drawer below 768px.
* Never rely on hover to reveal price, seller identity, image count, or an action. Touch targets are at least 44×44px.

## 3. Shared public-shell components

### 3.1 Single global header and footer

All buyer-facing pages use the exact same header: utility strip (language/currency/help), 72px white primary bar (wordmark, catalog categories, global search, account, cart), and an optional category strip. The header is sticky after first scroll and casts `--ap-shadow-1` only when sticky. The cart icon carries an accessible count badge.

The footer has a dark ink background and four practical columns: Buy inventory, Sell with AsiaPower, Support, and Trust & policies. It includes payment/security marks and no dead/repeated navigation. This replaces the inconsistent historic public templates.

### 3.2 Search and filters

Global search is a prominent 480–620px field with a left magnifier, placeholder `Search by make, model, chassis or stock ID`, and a result-suggestion panel. The suggestion panel separates **Vehicles**, **Categories**, and **Recent searches**. A chassis/VIN may be entered but the UI must clarify it is used to match inventory, not publicly displayed.

Filters are chips for fast choices (location, condition, price band) plus clearly labelled disclosure sections. Applied filters appear as dismissible chips above results. The result count, sort menu, view toggle, and filter trigger remain one logical toolbar.

### 3.3 Buttons and statuses

| Component | Visual | Intent |
|---|---|---|
| Primary | blue fill, white text | high-value progress: Add to cart, Continue to checkout |
| Reserve | orange fill, white text | Pay deposit / reserve action only |
| Secondary | white, blue 1px border | Compare, Request inspection, save changes |
| Quiet | no container, blue text | low-risk auxiliary action |
| Destructive | red outline/fill only in confirm UI | remove listing / cancel draft |
| Verified badge | success-tinted pill + shield icon | supplier verification / inspection completed |
| Stock badge | semantic pill | Available, Reserved, Sold, Draft, Needs changes |

All buttons have 44px minimum height, clear disabled state (not color-only), and a visible `:focus-visible` treatment using `--ap-focus`. Button labels start with a verb.

### 3.4 Trust components

* **Verified supplier card:** logo/initials, supplier display name, `Verified partner`, response-time range, origin country, and a link to public supplier storefront. Never show a supplier's direct phone, email, WhatsApp, social handle, or exact private address.
* **AsiaPower Protected Inquiry:** an info panel near all inquiry interactions: `AsiaPower masks direct contact details and manages messages until your transaction is confirmed.` Explain that the platform—not the supplier—will reply via the message centre.
* **Deposit protection card:** order total, deposit percentage/amount, balance due after confirmation, and a short policy link. Add only claims that legal/operations can substantiate.

## 4. Public storefront screen direction

### 4.1 Home — marketplace first, brand second

**Above fold:** Dark ink visual hero (roughly 600px desktop) with high-quality vehicle/yard image and a subtle blue gradient overlay. Left: eyebrow `GLOBAL AUTO INVENTORY`, 56px headline, one-line proof. Right/below on mobile: a large tabbed search module (`Vehicles`, `Engines`, `Parts`) with make/model/keyword, origin, and a blue `Search inventory` button.

**Immediately below:** a white trust strip: `Verified suppliers`, `Deposit protection`, `Inspected inventory`, `Managed logistics`. Each uses a simple outlined icon and short definition—not unsubstantiated metrics.

**Main body:**

1. `Shop by category` image-led tiles (Half cuts, Engines, Trucks, Machinery, Used cars) with a consistent 4:3 crop.
2. `Ready to reserve` horizontal product cards—image, vehicle name, stock ID, origin, status, EXW price, deposit from price, supplier badge, quick Add to cart.
3. A two-column procurement story: `How AsiaPower protects your purchase` next to a concise 4-step reserve process.
4. `Featured verified suppliers` merchant cards, with storefront link and inventory count; no direct outreach affordance.
5. A pragmatic dispatch/shipping CTA, then the unified footer.

Avoid an oversized marketing carousel. One purposeful hero and editorial whitespace beats a succession of generic banners.

### 4.2 Catalog / search results

Canvas background, breadcrumb then H1 (`Used Toyota Engines`) with count. The search/filter toolbar is in a white rounded panel. Vehicle cards are clean and transactional:

```
[4:3 image] [Photo count]        [Available]
2020 Toyota Land Cruiser VX
Stock AP-24-11802 · 52,300 km
Japan | Automatic | RHD
$28,400 EXW                    ♡
Deposit from $2,840             [+ Add to cart]
Sold by: Kanto Auto Parts [Verified]
```

The full card opens the PDP; the save heart, supplier link, and Add-to-cart are separate labelled interactive targets. No seller contacts. On hover desktop cards lift 2px; on mobile no lifting is needed.

Loading uses 3–6 image/text skeleton cards, not a blank catalog. Empty states explain the next action (`Clear filters`, `Request a sourced vehicle`) and retain prior filters for context.

### 4.3 Product detail page (PDP)

Desktop is a 7/5 split. Left is an image gallery: 4:3 main image, thumbnail rail, image count, fullscreen affordance and video badge. Right is a sticky purchase panel:

* availability badge, concise title, stock ID with copy action
* price and currency selector; `EXW Japan` as a precise qualifier
* deposit callout: `Reserve with 10% deposit — $2,840` plus balance statement
* quantity control fixed to 1 for unique inventory; primary `Add to cart`, reserve orange `Pay deposit now`, quiet `Request inspection`
* merchant mini-card: `Sold by Kanto Auto Parts`, verified badge, location/response time, public store link; no contact details
* `Your inquiry is protected by AsiaPower` microcopy / link

Below, content is organized as tab/anchor sections: Overview, Condition & inspection, Specifications, Shipping & payment, and Seller. The condition section uses a visual checklist and real media. The shipping section makes clear whether price excludes freight. Use a desktop sticky action bar after the purchase panel scrolls away; on mobile use a fixed bottom bar with price + Add to cart.

### 4.4 Cart

The cart is an explicit marketplace step, not a quotation black hole. Use a 8/4 column desktop layout:

* Left: grouped cart lines, each with thumb, item title/stock ID, seller name/badge, condition, EXW price, deposit amount, remove/save-for-later action.
* If items come from multiple suppliers, reveal separate seller groups and a platform-mediated message notice.
* Right: sticky order summary: merchandise subtotal, estimated deposit due today, trade terms note, promo input (only if supported), and primary `Proceed to secure checkout`.

At the top: an order stepper `Cart → Checkout → Deposit confirmed`. Buyer should never be surprised that freight and balance will be finalized later. If unique inventory becomes reserved, show an amber status with alternative action—not a silent remove.

### 4.5 Deposit checkout

Checkout is calm and narrow: a 7/5 content split, no competing catalog nav beyond logo/back-to-cart, and a visible support link.

1. **Contact and account:** email/phone plus country. Explain what AsiaPower shares with supplier (order requirements only, not direct contact coordinates).
2. **Reservation details:** each unique stock item and seller, inspection note, total EXW, `Deposit due today`, balance later, currency.
3. **Payment:** card/bank/wallet methods only after actual provider selection; PCI-sensitive controls are provider-hosted. Add an acknowledgement checkbox linking deposit/cancellation terms.
4. **Review / pay:** orange `Pay $2,840 deposit` is the final CTA. Its button label always includes the amount.

Confirmation uses a strong success icon, `Reservation received`, order reference, supplier response/verification next step, message-centre link, and a statement that direct contact remains managed through AsiaPower. Do not call a reservation “purchased” until balance, shipping, and handover rules make it true.

## 5. Supplier-facing workspace

### 5.1 Supplier shell

Supplier screens share an ink sidebar, 64px utility bar, neutral workspace canvas, page title row, and compact data panels. Sidebar: Overview, Inventory, Add listing, Inquiries, Orders & deposits, Storefront, Payouts, Team, Settings. A supplier avatar/store name opens account settings—not a consumer account dropdown.

The information architecture preserves the platform boundary: Inquiries offers a managed conversation and qualified requirements; it **never** reveals buyer phone/email/WhatsApp unless an approved post-transaction policy explicitly allows it.

### 5.2 Supplier overview

Top row: `Live inventory`, `New qualified inquiries`, `Deposits awaiting action`, `Response rate`. Each metric has explicit date range and trend, not decorative charts. Below: action rail (`Add listing`, `Complete 3 drafts`, `Reply to inquiries`), inventory health table, inquiry queue, and `How your storefront appears` preview card.

### 5.3 Inventory manager

Dense but breathable table with thumbnail, title/stock ID, price, availability, last updated, quality status, and kebab menu. Include search, filters, bulk selection, and `Add listing` primary action. Edits use a **right-side detail drawer** for quick price/status adjustments; full-page editor for media/specification changes. Unsaved changes are explicit and leaving warns the supplier.

Status semantics:

* `Live` = discoverable and purchasable.
* `Reserved` = protected from a buyer deposit, cannot be carted.
* `Sold` = read-only, excluded from catalog.
* `Draft` / `Needs changes` = never externally discoverable.

### 5.4 Add/edit listing workflow

Use a full-page progressive editor with autosaved draft indicator and numbered sections, not a single intimidating form:

1. **Identity:** category, make, model, year, stock ID; duplicates check immediately.
2. **Condition & specifications:** structured fields first, free text second. Condition must be selected before publish.
3. **Media:** drag/drop uploader, progress, minimum image requirement, crop/rotate, and a clear main-image choice. Image ordering affects storefront card.
4. **Commercial:** EXW price/currency, deposit eligibility, origin, lead time, availability. Put an explanatory preview beside deposit settings.
5. **Review & publish:** desktop + mobile listing preview, validations and `Publish listing` CTA.

Persist an in-editor preview pane on desktop; a `Preview listing` action opens it on mobile. Use review notices (`Missing main image`, `Price required`) at the field and an error summary at the top. The final publish confirmation reports what will be public and which fields remain supplier/internal only.

### 5.5 Inquiry centre (masked lead workflow)

The supplier needs enough context to respond commercially without bypassing AsiaPower. Structure it as three panes at desktop: queue, conversation, requirement/details panel. The buyer identity card displays first name/initial or company classification, country/region, verified buyer state, required item/quantity/destination, and response deadline. It explicitly shows `Contact protected by AsiaPower` with a lock icon.

Inbound content is automatically redacted for obvious phone/email/WhatsApp/URL contact attempts, with a clear non-accusatory message: `Direct contact details were removed to keep this inquiry protected. Reply here and AsiaPower will deliver your message.` Do not simply hide content without explanation. The response composer blocks new direct-contact patterns before send, suggests structured offers (price / availability / inspection / shipping), and asks for internal AsiaPower review only where needed.

### 5.6 Orders and deposits

Order list uses status chips: `Deposit received`, `Supplier confirmation needed`, `Preparing inspection`, `Balance pending`, `Shipping arranged`, `Completed`, `Cancelled`. A detail timeline shows who must act next. Deposit amounts should be visible only to allowed team roles and shown as amounts/currency plus policy status, never as a vague green “paid” mark. Build payout information separately from customer order information.

### 5.7 Public supplier storefront

It shares the buyer header/footer and product-card system, but supplier-specific surfaces show a banner, logo, display name, verification status, country, years on platform (only verified data), response-time range, categories, and active inventory. The CTA is `Shop inventory` / `Ask through AsiaPower`; never `Contact seller`.

## 6. Component library and states

| Component | Required variants / implementation notes |
|---|---|
| App header | buyer public, checkout minimal, supplier workspace; do not fork visual tokens |
| Vehicle card | catalog grid, horizontal cart line, mini recommendation; all use one metadata schema |
| Supplier identity | compact, PDP, storefront hero; display name + trust marker without contact info |
| Price block | EXW/full price, deposit-from, currency, disclaimer; tabular numeric alignment |
| Deposit status | eligible, awaiting confirmation, received, unavailable; text/icon/color together |
| Media gallery/uploader | loading, upload, error, reorder, selected main image, empty state |
| Data table | pagination, sort, filters, selection, skeleton, no-result, error/retry |
| Message composer | protected-content notice, redaction, inline validation, send status |
| Toast/alert | success, warning, error, info; never solely transient for payment/inventory outcome |
| Modal | confirm destructive action, publish confirmation; focus trap and return focus |

**Interaction details:** standard transitions max 220ms; toast entrance 150ms; no meaning is conveyed by animation alone. Product-card buttons should show `Added` with a check plus cart count update; errors persist near the control with a retry path. Optimistically update saved items only when recoverable—inventory reservations and payments require server-confirmed states.

## 7. Accessibility and localization baseline

* Meet WCAG 2.2 AA: 4.5:1 normal text contrast, 3:1 large text and component boundaries; token combinations above are intended for these thresholds and must be verified in implementation.
* Use semantic landmarks (`header`, `nav`, `main`, `footer`), native buttons/inputs, visible form labels, and real heading hierarchy. Icons have text labels/tooltips; decorative images use empty alt text; product imagery has useful alt based on title and angle.
* Full keyboard navigation: skip link, logical header → content → footer order, `Esc` closes dialog/drawer, modals trap focus, and action feedback is announced with `aria-live`.
* Keep 44px targets; do not lock zoom; support 200% zoom/reflow at 320 CSS pixels. Respect `prefers-reduced-motion` and do not autoplay vehicle video with sound.
* Localization: language/currency preference persists across public, checkout, and portal routes. Build for expanded text. Dates must include locale; money always has ISO currency context (`USD 2,840`). RTL support requires mirrored navigation and gallery controls—not merely text direction.
* Privacy: direct buyer/supplier contact must never appear in DOM, page source, analytics payloads, image metadata, downloadable exports, notifications, or preview copy. Redaction must be server-side; UI messaging is explanatory, not the security control.

## 8. Asset and performance guidance

* Catalog images: request responsive AVIF/WebP, 4:3 card crop with `object-fit: cover`; reserve original images for gallery zoom. Include neutral vehicle silhouette fallbacks, never broken-image chrome.
* Lazy-load below-fold imagery; fetch the PDP lead image at high priority; render catalog skeletons during inventory fetch. Compress supplier-upload preview derivatives, preserve original only in private storage.
* Use SVGs for UI icons and a coherent 1.75px stroke set. Avoid decorative icon libraries with inconsistent visual weight.
* Load display fonts only on pages that use them; system-sans fallback keeps checkout and portals fast.

## 9. Preview storyboard for the V7 static deliverable

The static preview should visually demonstrate one connected system through these frames (desktop first, with an explicit mobile frame for 02 and 03):

1. **01 Home** — hero search, trust strip, category tiles, ready-to-reserve cards, verified suppliers.
2. **02 Catalog** — filters, result toolbar, 3-column live inventory cards, cart count; mobile frame shows filter bottom sheet and one card.
3. **03 PDP** — gallery, seller identity, price/deposit/dual buying actions, trust modules; mobile frame shows sticky bottom add-to-cart bar.
4. **04 Cart** — grouped seller lines, deposit order summary, checkout stepper.
5. **05 Checkout** — protected-contact explanation, payment/deposit breakdown, amount-labelled final CTA, confirmation state.
6. **06 Supplier overview** — dark sidebar, health metrics, action rail, inquiry queue and storefront preview.
7. **07 Supplier inventory / editor** — listing table together with add/edit flow, media uploader, price and listing preview.
8. **08 Protected inquiry centre** — redacted lead detail, masking explanation, structured response composer, order/deposit timeline.

## 10. Design QA acceptance checklist

- [ ] Header, footer, navigation, typography, color, buttons and supplier badge look like one V7 product on every public screen.
- [ ] A buyer can understand price, EXW basis, deposit amount, seller identity, cart progress, and the next step without a sales call.
- [ ] A supplier can add, edit, price, preview, publish, and manage a listing without leaving the workspace.
- [ ] Supplier display name/storefront is visible; buyer direct contact is absent from all customer/supplier presentation states.
- [ ] The preview depicts cart and deposit as different steps and shows a confirmed-reservation outcome, not an unqualified payment success.
- [ ] All key states have loading, empty, error, and keyboard-focus treatments.
- [ ] Mobile layouts retain price, availability, seller identity, and the primary task instead of merely shrinking desktop blocks.

## 11. Handoff constraints and decisions needed before production

This is visual direction only. Production requires product/legal decisions for: which currencies and payment providers are available; exact deposit percentage/rules/refunds; when (if ever) contact disclosure is permitted; supplier verification eligibility; inspection promises; shipping ownership; role permissions; tax/invoice treatment; and redaction/audit retention policy. Claims in the V7 preview should be marked demonstrative until backed by these policies.

---

**Deliverable:** `docs/previews/v7-marketplace/agent-outputs/ui-design-system.md`  
**Absolute path:** `/Users/longhui/Desktop/AsiaPower/docs/previews/v7-marketplace/agent-outputs/ui-design-system.md`  
**Implementation handoff:** static preview may use this token set and 8-frame storyboard; it must not modify production UI before CEO review.
