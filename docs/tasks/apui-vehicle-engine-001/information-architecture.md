# Information Architecture

## Intent split

| Page family | Primary entity | Secondary | Must not |
|-------------|----------------|-----------|----------|
| Half-Cut | Vehicle (Brand + Model) | Engine confirmation | Force engine-first H1 |
| Engine | Engine Code | Displacement · Fuel · Applications | Force single vehicle as identity |

## Half-Cut card stack

1. **Brand + Vehicle Model** (visual H title)
2. **Engine Code · Displacement Fuel** (confirmation)
3. **Year** (single year today; range only if real field appears later)
4. **Status** — Available / Reserved / Sold

## Engine card stack

1. **Engine Code · Displacement Fuel**
2. **Fits / Applications summary** — first 2–3 real models + `+N Models` when longer
3. Optional muted brand/origin (not competing with code)

## Engine Detail modules

1. H1: `{Brand} {Code} {Displacement} {Fuel} Engine`（缺字段降级）
2. Specs chips from real data
3. **Compatible Vehicles** list from `applications` tokens（or knowledge models）
4. Short non-alarm disclaimer (see policy)
5. Internal links only to **existing** brand / half-cut / engine pages

## Surfaces in scope (implementation later)

Half-Cut: home featured, listing, detail, brand half-cut cards  
Engine: home featured, listing/catalog, brand popular, detail, related
