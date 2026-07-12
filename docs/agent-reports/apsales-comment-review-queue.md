# APSales Comment Review Queue

Generated: 2026-07-12 02:14 UTC

## Safety Boundary

- This queue is for public comment review only.
- Do not comment, DM, email, WhatsApp, or publish automatically.
- If a real buyer comment is found, copy the public comment text into local intel first, then run APSales demand draft generation.
- External replies require human approval.

## Run Summary

- Local intel rows reviewed: 28
- Comment review candidates: 1

## What To Look For In Comments

- Buyer wording: `where can i buy`, `where to buy`, `looking for`, `i need`, `need engine`, `need gearbox`, `who has`, `how much`, `price`, `quote`, `ship to`
- Product wording: `engine`, `gearbox`, `transmission`, `half cut`, `half-cut`, `tokunbo`, `spare parts`, `G4KD`, `G4NA`, `2TR-FE`, `1KD-FTV`, `2KD-FTV`
- Useful buyer details: country, vehicle model, engine code, gearbox type, destination port, budget, urgency.

## Review Queue

| Priority | Platform | Country | Signal | URL | Recommended Action |
| ---: | --- | --- | --- | --- | --- |
| 70 | youtube | Global | Sale New Hyundai Kia Gasoline Engine, G4KE G4FC G4NA G4LC G4KJ G4ED Engine Sale New Hyundai Kia Gasoline Engine, G4KE G4FC G4NA G4LC G4KJ G4ED Engine | https://www.youtube.com/watch?v=ywLp_XYJo_g | Open video, sort comments by newest/relevant, search buyer/product wording, capture public buyer comments only. |

## Next Step After A Real Buyer Comment Is Found

1. Save the public comment text and URL into `memory/customer_gateway/global_social_demand_intel.jsonl` with `intent_type: buyer_demand` only if it clearly asks for engine/gearbox/half-cut help.
2. Run `python3 scripts/apsales-social-autopilot.py --demand-drafts --json`.
3. Review the generated APSales draft.
4. Reply only after human approval.
