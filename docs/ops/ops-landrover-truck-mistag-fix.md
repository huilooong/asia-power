# OPS — Land Rover Freelander mis-filed as truck cab

**Date:** 2026-07-10  
**Stock:** HC250545

## Why it appeared under Truck Cabs

Upload/approval stored it as:
- `vehicleCategory: truck`
- `vehicleCondition: Driver Cab`
- `truckPartType: cab`

Homepage truck shelf shows items with those flags. The safety filter already blocked Chinese「路虎」but **missed English `Land Rover`**, so Freelander stayed on the truck shelf.

## Fix

1. Production data corrected → passenger / Half Cut; slug `…-half-cut-…`
2. Passenger OEM lists updated: `land rover`, `jaguar`, `jeep`, `porsche`, `lexus`, …
3. Files: `server/lib/vehicle-name-normalize.js`, `js/home-v4-hybrid.js`, `js/half-cut-directory.js`, `js/half-cut-upload-layer.js`

## Validation

- API `HC250545.vehicleCategory === passenger`
- Not listed in truck cab shelf
