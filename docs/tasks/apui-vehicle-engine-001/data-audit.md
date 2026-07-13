# APUI-VEHICLE-ENGINE-001 — Data Audit

**Source of truth for counts:** local files audited 2026-07-13（只读）。  
**Half-Cut inventory snapshot:** `work/half-cut-approved-prod.json`（467）  
**Engine catalog:** `js/engine-directory.js` → `ENGINE_DIRECTORY`（105 models / 97 unique normalized codes）

> 禁止凭常识猜测缺失字段。下列数字均来自文件实测。

---

## 1. Half-Cut fields

### Sources

| Layer | Path |
|-------|------|
| Production inventory | `work/half-cut-approved-prod.json`（审计快照）；现网经 `/api/half-cuts/public` |
| Runtime merge | `js/half-cut-inventory-store.js` → `HALF_CUT_LIST` |
| Seed demo | `js/half-cut-directory.js` `SEED_HALF_CUT_LIST` |
| Catalog backfill | `lookupEngineCatalogSpec()` ← `ENGINE_DIRECTORY` |

### Field coverage (467 approved)

| Field | Present | Notes |
|-------|---------|-------|
| brand | 467 / 467 | |
| model (vehicle) | 467 / 467 | |
| year | 467 / 467 | **单年数字；无 yearRange 字段** |
| engineCode | 421 / 467 | |
| displacement | 62 / 467 | 多数 UI 依赖目录回填 |
| fuelType | 69 / 467 | 上传表单不强制采集 |
| status | 467 / 467 | Available 466 · Reserved 1 · **Sold 0 in this snapshot**（Sold 存在于 seed） |

### Sample (real)

```
HC250510  Toyota Camry  2010  1AZ-FE  Available  (no fuelType/displacement on record)
HC250504  Hyundai ix35  2010  G4KD    Available  (no fuelType/displacement on record)
HC250105  Dongfeng …    2013  ZG24    Reserved   displacement=2.4L fuelType=Petrol
```

### Degradation reality

- `1AZ-FE`、`R20A3` 等库存代号**可能不在** `ENGINE_DIRECTORY` → 卡片不得虚构排量。  
- 误填例：`HC250514` `engineCode: "4.0L"`（排量被当成代号）——展示层需拒绝“纯排量串”当 engine code 主身份（实现阶段处理；本阶段仅记录）。

---

## 2. Engine fields

### Sources (multi-layer)

| Layer | Path | Fields |
|-------|------|--------|
| Static catalog (primary) | `js/engine-directory.js` | `code`, `displacement`, `fuel`, `applications`, `type` |
| Brand config | `js/config.js` `engineModels` | codes only；与 directory **大量不一致** |
| SEO detail set | `js/seo-engines.js` | 12 engines with richer SEO fields |
| Generated HTML | `engines/*.html` (~100) | chips + applications table from generate script |
| Knowledge | `knowledge/engines/g4kd.json` | 1 engine with evidence-wrapped applications |
| Live engines index | `engines/index.html` | **inventory parts view**, not directory cards |

### Catalog coverage (105)

| Metric | Count |
|--------|------:|
| Total models | 105 |
| Unique normalized codes | 97 |
| Have displacement | **105** |
| Missing displacement | **0** |
| Have fuel | **105** |
| Have applications text | **105** |
| Exactly 1 application token (comma-split) | **1** |
| Multiple applications | **104** |

### Sample (real)

```
2AZ-FE  2.4L Petrol  applications: "Camry, RAV4, Alphard"     (Toyota)
G4KD    2.0L Petrol  applications: "Optima, Sportage, Sorento" (Hyundai)
1HZ     4.2L Diesel  applications: "Land Cruiser 80/100 series"
```

---

## 3. Compatible Vehicles — where from?

| Source | Format | Used for |
|--------|--------|----------|
| `ENGINE_DIRECTORY[].models[].applications` | Comma-separated string | Catalog cards, backfill |
| `work/half-cut-approved-prod.json` aggregated by engineCode | model + year signals | `generate-engine-pages.mjs` HTML tables |
| `knowledge/engines/*.json` | `applications.models[]` + years | Only G4KD today |
| Dedicated compatibility API | **None** | — |

**Coverage definition for this audit (catalog):**  
105/105 directory rows have non-empty `applications` text → **100% catalog text coverage**.  
This is **not** guaranteed-fit data and **not** year-resolved.

Inventory-side: many stock engine codes lack a directory match (normalization + missing codes) → **no reliable applications string** for those codes until matched or curated.

---

## 4. Engine quantity summary

| Question | Answer |
|----------|--------|
| Engines with displacement (catalog) | 105 |
| Engines missing displacement (catalog) | **0** |
| Engines with fuel (catalog) | 105 |
| Engines with compatible vehicles text | 105 |
| Only one application | 1 |
| Multiple applications | 104 |
| Generated HTML pages with “Not verified yet” displacement | ~50（生成页层，非 directory） |

---

## 5. Conflicts (same engine code)

| Check | Result |
|-------|--------|
| Same normalized code, different displacement in directory | **0** |
| Same normalized code, different fuel in directory | **0** |
| Near-duplicate codes (HR16 vs HR16DE, QR25 vs QR25DE) | Present；applications 文本不同，排量/燃油一致 |
| Cross-brand shared codes (G4KD etc.) | 8 codes；排量/燃油一致，applications 按品牌不同（预期） |
| Turbo / NA / market fields in directory | **Absent** as structured fields |
| Aspiration conflict evidence | Not detectable in directory schema |

**“Application 数据冲突”计数（本审计定义）：**  
同规范代号下 displacement/fuel 不一致 = **0**。  
近重复代号 / config↔directory 分裂 / 库存代号未入目录 = **数据卫生问题**，另列，不算排量冲突。

---

## 6. Current rendering hooks (for later implementation)

| Surface | Function | File |
|---------|----------|------|
| Half-Cut listing title | `listingTitle` / `listingStructuredTitle` | `js/half-cut-directory.js` |
| Half-Cut specs line | `listingSpecsLineHtml` + catalog lookup | `js/half-cut-directory.js` |
| Engine card label | `EngineCardLabel.formatEngineCodeDisplacementFuel` | `js/engine-card-label.js` |
| Engine catalog card | `renderEngineModelCard` | `js/engine-catalog.js` |
| Home hub | `renderHalfCutCard` / `renderEngineCard` | `js/home-hub.js` |

---

## Audit verdict

| Ready for UI design? | Yes — with catalog-backed display + safe empty states |
| Invent missing displacement? | **No** |
| Compatible Vehicles ready as guaranteed fit? | **No** — applications text / inventory signals only |
| Need new DB this phase? | **No** |
