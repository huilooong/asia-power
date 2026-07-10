# TASK-008 Live Validation

Date: 2026-07-05 (UTC)

## Scope

Live HTTP validation of the 50 Production-001 engine pages listed in `docs/cto/production-001.md`.

Target base URL:

```text
https://asia-power.com/engines/
```

Validation rule: each page must return **HTTP 200** (follow redirects with `curl -L`).

## Summary (post-deploy)

| Metric | Count |
| --- | ---: |
| Total pages checked | 50 |
| HTTP 200 | **50** |
| HTTP 404 | 0 |
| Other / error | 0 |
| **Pass rate** | **100%** |

**Result: PASS** — all 50 Production-001 engine pages are live on production.

Validated at: **2026-07-05 03:29 UTC** (immediately after deploy from `origin/main @ 8536a1d5`).

## Control Checks

| URL | HTTP | Notes |
| --- | ---: | --- |
| `https://asia-power.com/engines/` | 200 | Index page live |
| `https://asia-power.com/engines/index.html` | 200 | Index alias live |
| `https://asia-power.com/sitemap.xml` | 200 | Dynamic sitemap live |
| `https://asia-power.com/sitemap.xml` contains `engines/g4fc.html` | yes | New engine URLs indexed |

## Page Results

| Page | URL | HTTP | Time (s) | Result |
| --- | --- | ---: | ---: | --- |
| `engines/g4fc.html` | https://asia-power.com/engines/g4fc.html | 200 | 0.405 | PASS |
| `engines/r20a3.html` | https://asia-power.com/engines/r20a3.html | 200 | 0.396 | PASS |
| `engines/g4na.html` | https://asia-power.com/engines/g4na.html | 200 | 0.470 | PASS |
| `engines/1zr-fe.html` | https://asia-power.com/engines/1zr-fe.html | 200 | 0.396 | PASS |
| `engines/hr16de.html` | https://asia-power.com/engines/hr16de.html | 200 | 0.465 | PASS |
| `engines/k24a8.html` | https://asia-power.com/engines/k24a8.html | 200 | 0.385 | PASS |
| `engines/2az-fe.html` | https://asia-power.com/engines/2az-fe.html | 200 | 0.453 | PASS |
| `engines/mr20de.html` | https://asia-power.com/engines/mr20de.html | 200 | 0.385 | PASS |
| `engines/g4gc.html` | https://asia-power.com/engines/g4gc.html | 200 | 0.385 | PASS |
| `engines/1az-fe.html` | https://asia-power.com/engines/1az-fe.html | 200 | 0.479 | PASS |
| `engines/g4kd.html` | https://asia-power.com/engines/g4kd.html | 200 | 0.382 | PASS |
| `engines/g4ke.html` | https://asia-power.com/engines/g4ke.html | 200 | 0.453 | PASS |
| `engines/r18a2.html` | https://asia-power.com/engines/r18a2.html | 200 | 0.482 | PASS |
| `engines/l13z.html` | https://asia-power.com/engines/l13z.html | 200 | 0.383 | PASS |
| `engines/hr15de.html` | https://asia-power.com/engines/hr15de.html | 200 | 0.451 | PASS |
| `engines/qr25de.html` | https://asia-power.com/engines/qr25de.html | 200 | 0.393 | PASS |
| `engines/1gr-fe.html` | https://asia-power.com/engines/1gr-fe.html | 200 | 0.377 | PASS |
| `engines/1nz-fe.html` | https://asia-power.com/engines/1nz-fe.html | 200 | 0.391 | PASS |
| `engines/2nz-fe.html` | https://asia-power.com/engines/2nz-fe.html | 200 | 0.453 | PASS |
| `engines/1zz-fe.html` | https://asia-power.com/engines/1zz-fe.html | 200 | 0.395 | PASS |
| `engines/2tr-fe.html` | https://asia-power.com/engines/2tr-fe.html | 200 | 0.452 | PASS |
| `engines/1kd-ftv.html` | https://asia-power.com/engines/1kd-ftv.html | 200 | 0.391 | PASS |
| `engines/2kd-ftv.html` | https://asia-power.com/engines/2kd-ftv.html | 200 | 0.382 | PASS |
| `engines/4jb1.html` | https://asia-power.com/engines/4jb1.html | 200 | 0.490 | PASS |
| `engines/k24a.html` | https://asia-power.com/engines/k24a.html | 200 | 0.471 | PASS |
| `engines/r18a.html` | https://asia-power.com/engines/r18a.html | 200 | 0.394 | PASS |
| `engines/l15a.html` | https://asia-power.com/engines/l15a.html | 200 | 0.465 | PASS |
| `engines/k20a.html` | https://asia-power.com/engines/k20a.html | 200 | 0.393 | PASS |
| `engines/g4kj.html` | https://asia-power.com/engines/g4kj.html | 200 | 0.450 | PASS |
| `engines/g4fg.html` | https://asia-power.com/engines/g4fg.html | 200 | 0.395 | PASS |
| `engines/m16a.html` | https://asia-power.com/engines/m16a.html | 200 | 0.382 | PASS |
| `engines/g4ed.html` | https://asia-power.com/engines/g4ed.html | 200 | 0.482 | PASS |
| `engines/2zr-fe.html` | https://asia-power.com/engines/2zr-fe.html | 200 | 0.380 | PASS |
| `engines/g6ba.html` | https://asia-power.com/engines/g6ba.html | 200 | 0.464 | PASS |
| `engines/k24z4.html` | https://asia-power.com/engines/k24z4.html | 200 | 0.384 | PASS |
| `engines/4b11.html` | https://asia-power.com/engines/4b11.html | 200 | 0.460 | PASS |
| `engines/l15a1.html` | https://asia-power.com/engines/l15a1.html | 200 | 0.392 | PASS |
| `engines/g4kc.html` | https://asia-power.com/engines/g4kc.html | 200 | 0.378 | PASS |
| `engines/m272-967.html` | https://asia-power.com/engines/m272-967.html | 200 | 0.467 | PASS |
| `engines/3zr-fe.html` | https://asia-power.com/engines/3zr-fe.html | 200 | 0.384 | PASS |
| `engines/4b12.html` | https://asia-power.com/engines/4b12.html | 200 | 0.380 | PASS |
| `engines/m271-951.html` | https://asia-power.com/engines/m271-951.html | 200 | 0.464 | PASS |
| `engines/r18a1.html` | https://asia-power.com/engines/r18a1.html | 200 | 0.393 | PASS |
| `engines/k10b.html` | https://asia-power.com/engines/k10b.html | 200 | 0.489 | PASS |
| `engines/l15a7.html` | https://asia-power.com/engines/l15a7.html | 200 | 0.383 | PASS |
| `engines/g4ka.html` | https://asia-power.com/engines/g4ka.html | 200 | 0.458 | PASS |
| `engines/3zz-fe.html` | https://asia-power.com/engines/3zz-fe.html | 200 | 0.380 | PASS |
| `engines/2gr-fe.html` | https://asia-power.com/engines/2gr-fe.html | 200 | 0.382 | PASS |
| `engines/1jz-ge.html` | https://asia-power.com/engines/1jz-ge.html | 200 | 0.443 | PASS |
| `engines/651-955.html` | https://asia-power.com/engines/651-955.html | 200 | 0.398 | PASS |

## Before / After

| Check | Pre-deploy (03:17 UTC) | Post-deploy (03:29 UTC) |
| --- | --- | --- |
| 50 Production-001 pages | 0/50 HTTP 200 | **50/50 HTTP 200** |
| `public/engines/g4fc.html` on server | missing | present |
| Production engine HTML count | 13 | 63 |
| `sitemap.xml` includes `engines/g4fc.html` | no | yes |

## Acceptance Criteria

| Criterion | Result |
| --- | --- |
| 50 engine pages HTTP 200 | **PASS** |
| `sitemap.xml` accessible | **PASS** |
| `/engines/` index accessible | **PASS** |
| No 404 on target 50 pages | **PASS** |

## Method

```bash
curl -sS -o /dev/null -w "%{http_code}|%{time_total}" -L --max-time 30 "https://asia-power.com/engines/<slug>.html"
```

Full deploy + validation log: `docs/cto/task-008-deploy-execution.log`

## Conclusion

**Live validation: PASS (50/50).**
