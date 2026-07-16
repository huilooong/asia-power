# SEO-012 Next Phases Execution Report

Status: Implementation in progress; not deployed  
Date: 2026-07-16  
Branch: `codex/seo-next-phases`  
Scope: APSEO-012 follow-up content, internal linking, sitemap and release validation coverage

## Purpose

Start the post-Phase-1 SEO execution work with changes that can improve organic traffic without changing production infrastructure:

- create real guide pages already declared in the sitemap
- connect guide content from the homepage, catalog pages, country pages and footer
- extend release validation so guide pages are checked before future deployment

## Files Modified

| File | Change |
| --- | --- |
| `guides/index.html` | Added buyer guide hub |
| `guides/buying-used-engines-from-china.html` | Added used engine import checklist article |
| `guides/fob-vs-cif-shipping-guide.html` | Added FOB vs CIF shipping guide article |
| `index.html` | Added Guides link to homepage navigation and footer-style link list |
| `js/config.js` | Added Guides to public navigation and SEO product links |
| `js/components.js` | Added Guides to public footer links |
| `engines/index.html` | Added buying guide card in related paths |
| `ghana.html` | Added shipping guide CTA beside catalog links |
| `nigeria.html` | Added shipping guide CTA beside catalog links |
| `scripts/lib/post-release-validation.mjs` | Added guide pages to public validation and required sitemap guide URL checks |

## Content Added

### Guide Hub

URL:

```text
/guides/
```

Purpose:

- create a crawlable hub for buyer education content
- link buyers to high-intent guide articles
- give search engines a durable parent page for guide content

### Buying Used Engines From China

URL:

```text
/guides/buying-used-engines-from-china.html
```

Targets:

- used engines from China
- buying used engines from China
- used engine import checklist
- engine code and gearbox matching before quote

### FOB vs CIF Shipping Guide

URL:

```text
/guides/fob-vs-cif-shipping-guide.html
```

Targets:

- FOB vs CIF for used engines
- CIF shipping used engines from China
- Africa import shipping quote
- Tema, Lagos, Cotonou, Douala, Abidjan, Mombasa shipping intent

## Validation Added

Release Manager now checks:

- `/guides/`
- `/guides/buying-used-engines-from-china.html`
- `/guides/fob-vs-cif-shipping-guide.html`

For each guide page, existing public validation covers:

- HTTP status
- title presence
- canonical presence
- WhatsApp number safety
- resolved `config.js` WhatsApp safety
- `#site-whatsapp` mount

Sitemap validation now also fails if the sitemap is missing:

- `/guides/`
- `/guides/buying-used-engines-from-china.html`
- `/guides/fob-vs-cif-shipping-guide.html`

## Validation Run

Passed:

```bash
node -c scripts/lib/post-release-validation.mjs
node -c js/config.js
node -c js/components.js
node -c server/half-cut-local-server.js
```

Passed local HTTP checks against `http://127.0.0.1:8799`:

| URL | Result |
| --- | --- |
| `/guides/` | HTTP 200, title present, canonical correct, JSON-LD present, WhatsApp CTA present |
| `/guides/buying-used-engines-from-china.html` | HTTP 200, title present, canonical correct, JSON-LD present, WhatsApp CTA present |
| `/guides/fob-vs-cif-shipping-guide.html` | HTTP 200, title present, canonical correct, JSON-LD present, WhatsApp CTA present |
| `/sitemap.xml` | HTTP 200, XML content type, guide URLs present |
| `HEAD /sitemap.xml` | HTTP 200 |

Passed dynamic sitemap generation check:

```text
https://asia-power.com/guides/ present
https://asia-power.com/guides/buying-used-engines-from-china.html present
https://asia-power.com/guides/fob-vs-cif-shipping-guide.html present
```

Full local OPS-003 was attempted, but the local public inventory API returned `approved: 0`, so the existing half-cut sitemap sample check cannot pass in this local environment. This should be re-run against production after deployment, where Phase 1 already validated live inventory samples.

## Not Deployed Yet

This work has not been deployed to production in this step.

Before deployment:

1. Run local syntax and static-page checks.
2. Run local server checks for guide pages and sitemap output.
3. Run Release Manager against a deployed release after CEO deploy confirmation.

## Next Recommended Batch

After this guide batch is validated and deployed:

1. Add two country-intent engine pages:
   - `/engines/ghana-used-engines-from-china.html`
   - `/engines/nigeria-used-engines-from-china.html`
2. Add internal links from Ghana/Nigeria country pages to the matching engine pages.
3. Add GSC query tracking once Search Console data is available.
4. Review cache policy separately because that touches production behavior.
