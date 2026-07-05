# TASK-008 - Engine Page Generator Upgrade

Date: 2026-07-05

## Generator Changes

- Added `scripts/generate-engine-pages.mjs` as a repeatable local Engine Page Generator.
- Generator reads Production-001 page list instead of hardcoding one engine page.
- Generator enriches each engine page from repository-local signals: engine directory, inventory files, transmissions, applications, related half-cuts, and task/growth sources.
- Generator now creates engine-specific sections:
  - Common Buyer Questions
  - Engine-specific Buying Guide
  - Engine-specific Inspection Checklist
  - Common Matching Mistakes
  - China Supply Notes
  - Related Half Cuts
  - Related Gearboxes
  - Export Notes
  - AsiaPower Recommendation
  - Engine-specific CTA
- Generator updates `sitemap.xml` with the regenerated 50 page URLs.

## Regenerated Pages

- `engines/g4fc.html` - G4FC: 80 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/r20a3.html` - R20A3: 66 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/g4na.html` - G4NA: 54 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/1zr-fe.html` - 1ZR-FE: 56 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/hr16de.html` - HR16DE: 45 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/k24a8.html` - K24A8: 29 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/2az-fe.html` - 2AZ-FE: 24 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/mr20de.html` - MR20DE: 22 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/g4gc.html` - G4GC: 25 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/1az-fe.html` - 1AZ-FE: 25 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/g4kd.html` - G4KD: 4 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/g4ke.html` - G4KE: 14 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/r18a2.html` - R18A2: 16 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/l13z.html` - L13Z: 13 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/hr15de.html` - HR15DE: 11 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/qr25de.html` - QR25DE: 9 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/1gr-fe.html` - 1GR-FE: 3 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/1nz-fe.html` - 1NZ-FE: 1 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/2nz-fe.html` - 2NZ-FE: 1 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/1zz-fe.html` - 1ZZ-FE: 0 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/2tr-fe.html` - 2TR-FE: 0 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/1kd-ftv.html` - 1KD-FTV: 0 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/2kd-ftv.html` - 2KD-FTV: 0 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/4jb1.html` - 4JB1: 3 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/k24a.html` - K24A: 0 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/r18a.html` - R18A: 0 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/l15a.html` - L15A: 0 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/k20a.html` - K20A: 0 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/g4kj.html` - G4KJ: 0 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/g4fg.html` - G4FG: 7 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/m16a.html` - M16A: 13 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/g4ed.html` - G4ED: 13 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/2zr-fe.html` - 2ZR-FE: 6 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/g6ba.html` - G6BA: 5 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/k24z4.html` - K24Z4: 10 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/4b11.html` - 4B11: 4 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/l15a1.html` - L15A1: 10 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/g4kc.html` - G4KC: 10 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/m272-967.html` - M272.967: 8 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/3zr-fe.html` - 3ZR-FE: 1 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/4b12.html` - 4B12: 1 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/m271-951.html` - M271.951: 6 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/r18a1.html` - R18A1: 6 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/k10b.html` - K10B: 6 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/l15a7.html` - L15A7: 5 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/g4ka.html` - G4KA: 5 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/3zz-fe.html` - 3ZZ-FE: 0 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/2gr-fe.html` - 2GR-FE: 0 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/1jz-ge.html` - 1JZ-GE: 0 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.
- `engines/651-955.html` - 651.955: 27 inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.

## Differentiation Notes

- Brand families use different buying guidance: Toyota, Honda, Nissan, Hyundai/Kia, Mercedes-Benz, diesel, and general patterns.
- Pages with strong inventory signals receive inventory-first recommendations; sourcing-only pages receive demand-capture language.
- Related gearbox notes come from actual transmission signals where available.
- Related half-cut blocks use matching repository records where available and avoid claiming live stock.
- Strongest inventory-backed regenerated pages: G4FC, R20A3, G4NA, 1ZR-FE, HR16DE, K24A8, 2AZ-FE, MR20DE, G4GC, 1AZ-FE, 651.955.

## Safety

- No official power, torque, bore, stroke, or service interval values are invented.
- Pages continue to say availability and price require confirmation.
- Supplier names, supplier phones, private notes, and full VINs are not exposed.
- No deployment, commit, external account login, social posting, or customer outreach was performed.
