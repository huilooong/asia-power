# CEO Real Reply Examples — 2026-07-14

Real messages the CEO typed manually (through the connected WhatsApp Business
number) tonight to rescue conversations the bot was mishandling. Extracted by
elimination: every "Asiapower:" line below did NOT match any bot-generated
template logged in `zijing_activity_stream.jsonl` / bridge.mjs for this
conversation, so it's CEO-authored, not bot output.

Source conversation: +233 53 407 9957 (Facebook/Instagram ad lead, Hyundai
Sonata 2012 complete engine + gearbox inquiry), 2026-07-14 ~05:51-06:00 UTC.
Full context: the bot was hitting repeated failures (rate limit + JSON
errors) this whole window — see `docs/tasks/openclaw-sales-agent/` incident
notes. The CEO manually carried the conversation.

## The examples (in order)

1. `hi` — bare, no greeting fluff.
2. `ok 2.0 or 1.8` — one clarifying question, minimum words, no punctuation ceremony.
3. `15000` — a bare number is a complete, valid reply on its own.
4. `booking from china` — short factual context, no explanation needed.
5. `sorry` — a full apology can be one word when the moment calls for it.
6. [sent a real photo of the matching engine in stock]
7. `There is one in stock, but we replaced the cylinder mattress for the engine.` — leads with availability, discloses a real condition detail (repair/replacement) upfront rather than hiding it.
8. `The normal price is 23,000, and this one only costs 15,000.` — anchors the full price first, then frames the actual offer as the discount off it. Two numbers, one sentence pattern.
9. `If you want a more perfect one, you can book with us.` — soft upsell, no pressure, offers the alternative without dismissing the discounted option.
10. `www.asia-power.com` — bare link, no "check out our website!" framing.
11. `Our inventory in China is all here. What do you need? We will disassemble it for you.` — pivots to breadth of stock + a concrete service offer (disassemble to order), ends on a direct question.
12. `Sorry, this stupid artificial intelligence robot has caused you a bad influence. I'm repairing it.` — owns the failure directly to the customer, no corporate hedging.

## Pattern worth carrying into the sales-agent prompt

- Numbers stand alone. No "the price is..." — just the number, or the number in a one-clause sentence.
- Price anchoring: state the normal/full price and the actual offer together in one sentence, not two separate claims.
- Condition transparency: disclose repairs/replacements as a matter-of-fact detail, not a caveat.
- Apologies and admissions are short and direct, not padded.
- Ends turns on a concrete question or next step, not an open-ended "let me know."

## Follow-up (not done tonight — flagged for Cursor)

`sales_coach/training.py` already has a structured pipeline for building
improvement plans from conversation "turns" (`decisions`/`context`/`meta`
fields), tied to the legacy `draft_queue` data flow. This file is a raw,
manually-curated starting point — wiring these examples (and future ones,
extracted the same way: diff real WhatsApp exports against bot-logged
replies) into that formal pipeline, or into the OpenClaw `sales-agent`'s own
few-shot examples, is separate follow-up work.
