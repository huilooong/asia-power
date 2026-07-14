# Vendor research — Vision OCR / STT / JDM frame decode

Status: research complete — **CEO decisions required before production cloud keys go live**.  
Code adapters are already wired behind env flags (see below).

## A. Cloud Vision OCR (replace/augment tesseract)

### Why

Tonight’s two real failures (handwritten registration; clear but small SCP90 plate in a busy frame) are structural limits of whole-image tesseract on a 3.8GB VPS — not more preprocessing.

### Options (rough cost)

| Vendor | Feature | Free tier | Pay-as-you-go | Handwriting / region detect | Fit for APSales |
|---|---|---|---|---|---|
| **Google Cloud Vision** | `DOCUMENT_TEXT_DETECTION` | 1,000 units/mo | ~$1.50 / 1,000 images | Strong; built-in layout/boxes | **Recommended** |
| AWS Textract | Detect Document Text | 1,000 pages/mo (12 mo) | ~$1.50 / 1,000 text; forms much more | Good docs; heavier AWS setup | Alternative if already on AWS |
| OpenAI GPT Vision | `gpt-4o-mini` image→text | none | token-based (higher variance) | Good on messy photos | Good backup; cost less predictable |
| Local EasyOCR/Paddle | — | infra only | VPS CPU/RAM | Better than tesseract, heavy | **Rejected** tonight (concurrency / RAM) |

### AsiaPower volume sketch

Assume 50–200 plate/registration photos/day on +233:

- ~1,500–6,000 images/month → Google free tier covers low end; mid ≈ **$1–8/month** after free tier.
- Even 20k/month ≈ **~$28**.

### Recommendation

1. **Primary:** Google Cloud Vision `DOCUMENT_TEXT_DETECTION`
2. **Env:** `APSALES_OCR_PROVIDER=google` + `APSALES_GOOGLE_VISION_API_KEY` (or `GOOGLE_CLOUD_VISION_API_KEY`)
3. Keep `tesseract` as automatic fallback when cloud fails / key missing
4. Do **not** enable in production until CEO provisions the key

### CEO decision needed

- [ ] Approve Google Vision (or pick AWS / OpenAI)
- [ ] Provision API key into production env (same pattern as other secrets — not in git)
- [ ] Confirm monthly budget ceiling (suggest $20 soft / $50 hard)

---

## B. Speech-to-text (voice notes)

### Options (batch, WhatsApp voice notes)

| Vendor | Model | Approx $/min | Notes |
|---|---|---|---|
| **OpenAI** | `gpt-4o-mini-transcribe` | ~$0.003 | Simple upload API; English + many languages |
| AssemblyAI | Universal-2 | ~$0.0025 | Cheapest; async poll |
| Google Speech | Chirp / latest_long | ~$0.004–0.016 | Strong multilingual; more GCP setup |
| Local Whisper | large-v3-turbo | infra | **Not recommended** on this 3.8GB VPS |

### Volume sketch

30–100 voice notes/day × ~30s average ≈ 15–50 min/day ≈ 450–1,500 min/month  
→ OpenAI mini ≈ **$1.5–4.5/month**.

### Recommendation

1. **Primary:** OpenAI `gpt-4o-mini-transcribe` (simple, already common in AI stacks)
2. **Env:** `APSALES_STT_PROVIDER=openai` + `OPENAI_API_KEY` / `APSALES_OPENAI_API_KEY`
3. Until CEO decides: `APSALES_STT_PROVIDER=none` → deterministic “please type it” reply (already coded)

### CEO decision needed

- [ ] Pick STT vendor (recommend OpenAI)
- [ ] Provision API key
- [ ] Confirm languages priority (English Ghana/Nigeria + French optional)

---

## C. JDM 车台番号 (frame number) decode services

### Important distinction

| ID type | Current AsiaPower path |
|---|---|
| 17-char VIN | Real external decode: `enrich_from_vin()` → AsiaPower store → **NHTSA vPIC** |
| Japanese frame (e.g. `SCP90-5185026`) | **No NHTSA equivalent** — tonight we regex-parse the *other* text on the same plate |

### What exists commercially / publicly

| Service | What it gives | API? | Cost | Use for APSales parts sales? |
|---|---|---|---|---|
| [jdmvin.com](https://jdmvin.com/) | MLIT recalls + OEM grade/production window | Web UI; no public REST documented | Free (ads) | Recall/grade — **not** engine/parts catalog |
| [JP Sheet](https://jpsheet.com/) | Auction sheet / history / chassis decoder pages | Consumer web; photo AI extract | Paid tiers for reports | Import history — weak for EXW parts quoting |
| Carapis / Goo-net parsers | Listing search, chassis→trim from portal data | REST (commercial) | Paid API | Spec/trim from listings — not a VIN-style registry |
| OEM JP portals | Domestic recall/grade | JP-only forms | Free but scattered | Same as jdmvin sources |

### Research conclusion

- There is **no** clean “NHTSA for 车台番号” that returns engine/gearbox/parts compatibility as a stable public API.
- Best near-term: keep **label-based plate OCR** (ENGINE / FRAME No. / MODEL) after Vision API upgrade.
- Optional later: wire **jdmvin / MLIT** only for recall/grade enrichment (nice-to-have, not blocking sales replies).
- Optional commercial: Carapis/Goo-net if CEO wants auction-grade trim lookup — budget + contract required; **do not** scrape Goo-net HTML.

### CEO decision needed

- [ ] Accept “OCR labels + NHTSA for 17-VIN only” as Phase 1 (recommended)
- [ ] Or approve paid Carapis/JP Sheet exploration for Phase 2

---

## Env flag cheat-sheet (already in code)

```bash
# OCR
APSALES_OCR_PROVIDER=tesseract|google|openai
APSALES_GOOGLE_VISION_API_KEY=...
# or OPENAI_API_KEY for openai vision

# STT
APSALES_VOICE_STT_ENABLED=true
APSALES_STT_PROVIDER=none|openai|google|assemblyai
OPENAI_API_KEY=...   # for openai STT
```
