# APUI-VEHICLE-ENGINE-001 — Review

## Phase

**Audit → Design → Preview** complete.  
**Not done:** Commit / Push / Deploy / production code wiring.

## Decisions locked

- Half-Cut = Vehicle-first  
- Engine = Engine-first  
- Compatible Vehicles ≠ guaranteed fit  

## CEO ask before implementation

1. Approve three HTML previews  
2. Confirm year display: single `year` only until real year-range field exists  
3. Confirm engines listing remains inventory parts vs also showing directory cards (existing dual mode)

## Risks called out

- Catalog displacement coverage 100%; **inventory** displacement sparse  
- 0 displacement/fuel conflicts in directory; near-duplicates + config drift remain  
- Do not invent apps for unmatched inventory codes  

## Next (after CEO OK)

Wire Half-Cut / Engine card renderers to IA rules using existing `EngineCardLabel` + directory lookup — still no new pages/APIs.
