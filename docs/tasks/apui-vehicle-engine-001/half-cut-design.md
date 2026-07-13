# Half-Cut Design

## Display order (CEO locked)

```
Toyota Camry
2AZ-FE · 2.4L Petrol
2008–2011   ← today usually single year e.g. 2010
Available
```

## Line rules

| Line | Content | Rules |
|------|---------|-------|
| 1 | Brand + Model | Visual primary; no stockId in title |
| 2 | Code · Disp Fuel | Join with ` · `; skip empty parts; no double separators |
| 3 | Year | Use `year`; if only one year show `2010` not fake range |
| 4 | Status | Available / Reserved / Sold only from data |

## Degradation

| Missing | Line 2 becomes |
|---------|----------------|
| displacement | `2AZ-FE · Petrol` |
| fuel | `2AZ-FE · 2.4L` |
| both | `2AZ-FE` |
| engineCode | omit line 2（不虚构代号） |

Backfill displacement/fuel **only** via existing `ENGINE_DIRECTORY` lookup（`EngineCardLabel` / `lookupEngineCatalogSpec`）。Lookup miss → degrade, never invent.

## Detail H1

Preferred: `Toyota Camry Half Cut — 2AZ-FE 2.4L Petrol`  
If SEO template forbids em dash: `Toyota Camry Half Cut 2AZ-FE 2.4L Petrol`

## Status

Keep existing sort rules. Colors: Available green · Reserved amber · Sold muted.

## Height

One title + three compact meta lines; no extra badge rows in card hero.
