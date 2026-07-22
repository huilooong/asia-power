# APGEO-001 Generative Engine Optimization Plan

Status: Phase 1+2 implemented and ready for production deploy (2026-07-22); Phase 3 remains off-site/PR
Date: 2026-07-22
Scope: asia-power.com discoverability and citation quality inside AI answer engines (ChatGPT/SearchGPT, Perplexity, Google AI Overviews/Gemini, Copilot, Claude) — distinct from classic Google-ranking SEO covered by APSEO-011/012
Owner: AsiaPower SEO / Growth
Production impact: Phase 1 is additive only (new root file + robots.txt documentation section). No existing behavior changes, no deploy risk.

## Why This Is a Separate Track From APSEO-011/012

APSEO-011/012 target Google organic ranking: sitemap hygiene, canonical URLs, Product/FAQ schema, Search Console loop. That work is real and should continue.

GEO (Generative Engine Optimization) targets a different outcome: being the source an AI assistant cites or paraphrases when someone asks it a question instead of searching Google directly (e.g. "who exports used engines from China to Ghana" typed into ChatGPT or Perplexity). The mechanics differ:

| SEO | GEO |
| --- | --- |
| Ranks a URL in a results list | Gets a fact/sentence lifted into a generated answer |
| Rewarded by backlinks, CTR, dwell time | Rewarded by unambiguous entity facts, extractable Q&A, clean crawl access for AI bots |
| Crawled by Googlebot | Crawled/fetched by GPTBot, PerplexityBot, ClaudeBot, Google-Extended, OAI-SearchBot, etc. — separate user-agents with separate rules |
| One canonical answer per query | Answer engines synthesize across many sources, so ambiguous entities get merged/mistaken |

AsiaPower has a specific, already-diagnosed GEO risk (see `docs/ops/seo-brand-query-asia-power-diagnosis-2026-07-15.md`): the bare phrase "Asia Power" is dominated by unrelated entities — an electrical-equipment maker (asiapower.net), a switchgear company (asiapowerllc.com), and the Lowy Institute's geopolitical "Asia Power Index." That diagnosis was written for Google SERP competition, but the same ambiguity is worse for LLM answer synthesis, which blends multiple same-name sources into one answer unless given a clear disambiguating fact to anchor on.

## Evidence Reviewed

| Area | Finding |
| --- | --- |
| `robots.txt` | `User-agent: *` / `Allow: /` — already permits all crawlers including AI bots by default, but has no explicit statement about them |
| `llms.txt` | Does not exist |
| Organization JSON-LD (`index.html`, `about.html`) | Good entity base: name, logo, contactPoint (phone/email/languages), two addresses (Zhengzhou CN + Accra GH). No `sameAs` (no social profiles found in codebase to link), no fabricated `foundingDate`/`aggregateRating` — correctly avoided per APSEO-011 safety rules |
| FAQPage / Product schema | Already present on ~60 engine pages, guide pages, catalog pages (APSEO-011 Phase 1/2 work) — this is GEO-relevant infrastructure that already exists and should not be duplicated |
| Guide content (`guides/buying-used-engines-from-china.html`, `guides/fob-vs-cif-shipping-guide.html`) | Good raw material for GEO — buyer-question framing already close to how people phrase LLM prompts |
| Brand disambiguation sentence | Already present in meta description ("automotive powertrains, not electrical power equipment") but not in a machine-readable, LLM-fetchable summary document |

## Phase 1 — Foundational, Additive, Zero Production Risk (Implemented)

1. **`/llms.txt`** — new root file following the emerging llms.txt convention (plain markdown, no HTML parsing needed). Gives any LLM that fetches the site a clean, curated summary instead of having to parse nav/sidebar/JS: what AsiaPower is, explicit disambiguation from the unrelated same-name electrical/geopolitical entities, core catalog links, guide links, country pages, and contact facts. This directly targets the diagnosed brand-confusion risk in a format LLMs are increasingly trained/instructed to check first.
2. **`robots.txt` AI-crawler section** — added an explicit, commented block naming the major AI answer-engine bots (GPTBot, ChatGPT-User, OAI-SearchBot, PerplexityBot, ClaudeBot, anthropic-ai, Google-Extended, Applebot-Extended, Amazonbot, Bytespider, meta-externalagent) as intentionally allowed. Behavior is unchanged (wildcard already allowed them) — this only removes ambiguity for future edits and gives a documented place to revisit if any bot should later be restricted.

Neither change touches existing pages, schema, sitemap, or server code.

## Phase 2 — Content Extractability (Implemented 2026-07-22)

These require judgment calls about tone/scope across many pages, so they are proposed here rather than applied silently:

1. **Answer-first paragraphs**: on the top 16-20 highest-signal engine pages and both guide pages, add a short (2-3 sentence) direct-answer block immediately under the H1 that states the core fact in plain, quotable language before any marketing framing — this is the sentence an LLM is most likely to lift verbatim. Existing FAQPage schema on these pages is good infrastructure; the visible prose should mirror the schema answers so text and structured data reinforce each other.
2. **Expand buyer-question coverage** in the guide hub with the specific phrasings people type into ChatGPT/Perplexity rather than Google (conversational, longer, "is it safe to...", "how do I..."), e.g.:
   - "Is it safe to import a used engine from China to Ghana?"
   - "What's the difference between buying a half-cut and an engine-only?"
   - "How do I confirm an engine code before paying a deposit?"
   These overlap with APSEO-011 Phase 2/3 planned guides — recommend merging into that backlog rather than duplicating page creation.
3. **QAPage schema** alongside existing FAQPage on the guide hub — same content, additional schema type some AI crawlers parse preferentially for direct Q&A.

## Phase 3 — Off-Site Signal (Proposed, Outside Website Code)

Not a website change, flagged for awareness: AI answer engines weight third-party mentions (Reddit, Quora, trade forums, industry directories, YouTube) heavily, often more than the brand's own site. This is a content/PR motion, not a code change, and would need a separate owner/channel decision — noted here so it isn't lost, not actioned.

## Safety Rules (carried over from APSEO-011)

Do not add: fake reviews, fake ratings, fabricated founding dates, guaranteed availability, or unverified specs — in `llms.txt` or anywhere else. Every fact in `llms.txt` is sourced from existing on-site content (`about.html`, `index.html` Organization schema, `js/config.js`).

## Next Step

Phase 1+2 are in the working tree for deploy via Release Manager (`chrome` covers `llms.txt`/`robots.txt`/guides; `engines` covers engine code pages). Phase 3 (off-site mentions) remains a separate growth/PR decision — not a website deploy.

### Phase 2 deliverables (this pass)

- Answer-first paragraphs on 20 highest-stock engine pages + both guides + guide hub
- Conversational buyer Q&A on guide hub / buying guide / FOB guide
- FAQPage + QAPage schema on guide hub and both guide articles
- `llms.txt` contact email aligned to `sales@asia-power.com`; `Bytespider` listed in robots
