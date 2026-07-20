# tires-category-001

## Goal
- New passenger-parts subcategory: used/scrap tires (`passengerPartType=tire`)
- Catalog: `/tires/`
- Supplier upload: Passenger Parts → Used/scrap tires (no VIN)
- Fix HC250585 mis-tagged as front cut

## Preview
- Local: `tires/index.html` via static server
- Upload: `supplier-portal/passenger-parts-upload.html?part=tire`

## Production
CEO approved business need → deploy `api` + `chrome` + `portal` + `admin`, then reclassify HC250585.
