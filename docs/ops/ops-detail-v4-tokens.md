# OPS · Detail page visual tokens (v4)

**Status:** Deployed  
**Scope:** Fonts / colors / type sizes only — **layout unchanged**

## What changed

| Item | Before | After (homepage v4) |
|------|--------|---------------------|
| Font | Inter + Barlow Condensed | Apple system stack |
| Text | `#191919` / eBay blue | `#1d1d1f` / `#0066cc` |
| Gold / EXW | slate gray badge | `#d4880a` + `#fef3dc` |
| Title | ~17–22px / 600 | **22px / 700** |
| Price | navy `#0a1628` | **34px / `#1d1d1f`** |
| Primary CTA | eBay blue | black `#1d1d1f` |

## Files

- `css/detail-v4-tokens.css` (new)
- `half-cuts/detail.html`
- `trucks/detail.html`
- `machinery/detail.html`

## Deploy

```bash
rsync -av css/detail-v4-tokens.css \
  root@159.65.86.24:/root/.openclaw/workspace/inventory-site/public/css/
rsync -av half-cuts/detail.html \
  root@159.65.86.24:/root/.openclaw/workspace/inventory-site/public/half-cuts/
rsync -av trucks/detail.html \
  root@159.65.86.24:/root/.openclaw/workspace/inventory-site/public/trucks/
rsync -av machinery/detail.html \
  root@159.65.86.24:/root/.openclaw/workspace/inventory-site/public/machinery/
```

## Verify

Open any listing detail → hard refresh. Title/price/buttons should match homepage look; photo/buybox grid unchanged.
