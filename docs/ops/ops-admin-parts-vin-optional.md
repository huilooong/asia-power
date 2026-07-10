# OPS · Admin approval: VIN optional for parts

## Problem
Supplier parts upload no longer requires VIN, but admin approval still treated many part listings as full vehicles (VIN required), and the edit form only marked truck parts as optional.

## Fix
- `js/half-cut-review-layer.js` — `isLoosePartListing()`; VIN not required for passenger/truck parts
- `js/admin-review-cards.js` — show「配件选填」for all parts; keep current condition in dropdown; passenger part type field
- `js/half-cut-vin.js` — add Front Cut / Part / Transmission etc. to `VEHICLE_CONDITIONS`
- `js/half-cut-upload-layer.js` — resolve part type from vehicleCondition when field missing

## Deployed
```bash
rsync js/half-cut-review-layer.js js/half-cut-upload-layer.js js/half-cut-vin.js js/admin-review-cards.js \
  root@…/public/js/
rsync admin/inventory.html root@…/public/admin/
```

## Verify
Open Admin Inventory Hub → Pending → approve a Front Cut / Part with empty VIN → should succeed.
Whole half-cuts still require 17-char VIN.
