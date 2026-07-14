# WhatsApp Sales-Agent Follow-ups — 2026-07-14

Status: **implemented (code + research + tests)** — waiting on CEO vendor/key
decisions before enabling cloud OCR/STT in production.
Deliverables: `vendor-research-vision-stt-jdm-2026-07-14.md`,
`tests/test_apsales_media_vin_pipeline.py` (12/12), rewritten
`whatsapp-media-vin-pipeline-2026-07-14.md`. Claude role was spec authoring;
Cursor implemented.

Everything below is a gap identified but NOT fixed during tonight's live
production work — either out of scope for a same-night hotfix, or requiring
a decision (vendor, cost, API keys) that isn't Claude's or Cursor's to make
unilaterally.

## 1. Voice message support (new feature)

Customers frequently send voice notes. Currently the bridge has no handling
for `kind: "audio"` / voice messages at all — they fall through to the
generic `[customer sent 语音]` placeholder text path in `bridge.mjs`
(`mediaLabel()`), same as any other unhandled media type.

Needed, mirroring the image/VIN pipeline built tonight:
- Audio download: extend `apsales-whatsapp-session.mjs`
  (`downloadInboundImage` is image-specific; needs an equivalent
  `downloadInboundAudio` or a generalized `downloadInboundMedia`) —
  reuse the same `downloadMediaMessage` primitive, same size-limit /
  MIME-whitelist / audit-log pattern already in place for images.
- Speech-to-text: needs a real STT engine decision. Options to evaluate:
  - Cloud STT API (Google Speech-to-Text, OpenAI Whisper API, AssemblyAI) —
    same tradeoff shape as the OCR decision below: no local compute cost,
    handles accents/background noise better, costs money + needs API key
    provisioning + CEO sign-off on vendor/cost.
  - Local Whisper (whisper.cpp or faster-whisper) — no per-call cost, but
    this VPS is resource-constrained (3.8GB RAM, already tight — see the
    OCR concurrency incident tonight where multiple simultaneous requests
    pushed the box hard). A local STT model adds real CPU/RAM load per
    voice note. Needs a sizing check before committing to this path.
- Feed the transcribed text into the EXISTING text-reply path
  (`runOpenClawReply`'s `customer_message` field) rather than building a
  parallel pipeline — a transcribed voice note should behave exactly like
  a typed message once it's text.
- Transcription confidence/failure handling: same pattern as OCR — low
  confidence or failed transcription should get a deterministic "sorry,
  could you type that or resend more clearly" reply, not silence or a
  slow LLM round-trip.

## 2. Replace/augment tesseract OCR with a cloud Vision API

Tonight's two real-customer OCR tests both failed:
- A handwritten vehicle registration document (tesseract has essentially no
  handwriting capability).
- A genuinely clear, well-lit metal chassis plate (SCP90-5185026) — failed
  because the current pipeline OCRs the whole photo with no text-region
  detection/cropping step first; the plate was a small fraction of the
  frame, dominated by background (car seat fabric).

Recommendation: move to a cloud Vision API (e.g. Google Cloud Vision
`DOCUMENT_TEXT_DETECTION`, or AWS Textract) instead of continuing to patch
tesseract preprocessing heuristics. Why this beats both tesseract and a
local deep-learning OCR (EasyOCR/PaddleOCR) for this specific case:
- Built-in text region detection — solves the "no cropping step" problem
  directly, no need to hand-build a plate-localization model.
- Meaningfully better handwriting recognition than tesseract.
- Zero local CPU/RAM cost — runs in the cloud, so it doesn't contribute to
  the kind of concurrency-driven slowdown fixed tonight (commit
  `76320d324`, where concurrent real customers pushed one OCR call to
  306 seconds on this 3.8GB VPS). This was the main reason EasyOCR was
  rejected earlier tonight (PyTorch is heavy, cold-starts per subprocess
  spawn are slow on this box) — a cloud API sidesteps that tradeoff
  entirely since there's no local model to load.

Tradeoffs needing a CEO decision, not Cursor's or Claude's to make alone:
- Which vendor (cost, existing account/billing relationship if any).
- API key provisioning and where credentials live (production `.env`,
  same pattern as `QXB_APPID`/`QXB_SECRET`).
- Per-call cost at expected volume — needs a rough estimate before
  committing.

Cursor should research vendor options + rough cost estimate and bring a
recommendation back rather than picking one and integrating silently.

The hardcoded Toyota-SCP90-specific parsing in
`scripts/apsales-media-vin-ocr.py` (`_extract_facts()` — hardcoded
`"AHXGK"`, `"3Q8"`, `"FQ42"/"FO42"` fallback values, all specific to the
CEO's own test vehicle) becomes moot if this migration happens, since a
cloud Vision API's raw text output would still need parsing into
manufacturer/model/engine/color/trim fields — that parsing logic should be
rebuilt generically (label-based extraction: find "COLOR:", "ENGINE:" etc.
and take what follows) rather than porting today's hardcoded patterns.

### 2b. Research a real JDM frame-number decode service (don't just improve regex)

Important distinction, worth being explicit about: standard 17-char VINs
are ALREADY decoded via a real external source (`enrich_from_vin()` ->
NHTSA vPIC, the official US database) — that part is not hand-rolled.
Japanese "frame numbers" (e.g. `SCP90-5185026`) are the exception: there is
no NHTSA-equivalent international registry for JDM-internal chassis codes,
which is why `_extract_facts()` currently regex-parses the OTHER text
printed on the same nameplate (engine code, color code, model suffix)
instead of looking anything up. Before investing more in that regex
parsing, Cursor should spend a research pass checking whether a real
JDM decode service/database exists commercially (Japanese auction-house
data providers, Goo-net, or similar) that could replace the guesswork the
same way NHTSA already replaced it for standard VINs. If one exists at a
reasonable cost, prefer wiring that in over building a better local
label-parser.

## 3. 10-scenario automated test suite (from original task spec)

Still not created. Required scenarios: clear VIN plate, tilted, low-light,
confusable characters (0/8, 1/L, 5/S), no-VIN photo, oversized image,
unsupported format, download failure, VIN tool failure, non-JSON
sales-agent reply. Use redacted/synthetic test images, not real customer
photos.

## 4. Final task report update

`docs/tasks/openclaw-sales-agent/whatsapp-media-vin-pipeline-2026-07-14.md`
is still the early draft from ~05:22 UTC and doesn't reflect the full
night's work (10+ commits: OCR crash fix, wall-clock timeout cap, pricing/
discount/address rules, Telegram gating, CEO-voice style rules, the
gateway model-config fix). Needs a full rewrite covering the real timeline
and current state, not a patch.

## Context Cursor should have but might not

- Tonight's production incidents were caused by THREE independent root
  causes, now distinguished (don't conflate them in future debugging):
  1. OCR crash bug (fixed, commit `6a9bc2929`)
  2. OCR wall-clock unbounded under concurrent load (fixed, commit
     `76320d324`)
  3. A broken global default model ID
     (`openrouter/google/gemini-2.5-flash-preview`, invalid/deprecated,
     fixed directly in `~/.openclaw/openclaw.json` on production — NOT in
     this git repo, so there's no commit for it; backup at
     `~/.openclaw/openclaw.json.bak-20260714T080645Z` on the production
     host). This was likely responsible for a large share of tonight's
     rate-limit-flavored failures, not just isolated capacity exhaustion.
- Testing directly against the live production WhatsApp number
  (rather than an isolated test number/environment) is what let tonight's
  bugs reach real customers before being caught. Worth a process fix
  independent of any single bug.
