# AsiaPower video-cover resilience audit — 2026-08-22

## Status

Local preview and deployment candidate complete. Production has not been changed by this follow-up.

## Verified production findings

- The homepage featured card selected `HC250130` and rendered a YouTube thumbnail as its only image layer.
- In the audited Chrome session, all eight homepage YouTube thumbnail images completed with `naturalWidth=0`; the user saw a broken-image label on both desktop and mobile.
- The homepage contained nine video covers: eight YouTube covers and one self-hosted MP4 cover.
- The live inventory API returned 599 records: 41 with video, comprising 40 YouTube URLs and one self-hosted MP4.
- Every one of those 41 video listings also has at least one customer evidence photo, so a same-origin photo fallback is available without modifying inventory data.
- The public HTML response advertised a CSP that did not allow `i.ytimg.com`, while product renderers requested thumbnails from that origin. The UI and both CSP sources were therefore inconsistent.
- Representative production checks covered homepage, half-cuts, engines, trucks, machinery, export used cars, YouTube detail and self-hosted-video detail. No horizontal overflow was found at 1512 px or 390 px.

## Candidate behavior

1. A YouTube cover now renders the first customer evidence photo as the always-present base layer.
2. The YouTube thumbnail begins hidden and becomes visible only after a successful image load with non-zero natural width.
3. If the third-party thumbnail is blocked, unavailable or slow, the customer photo remains visible with the Video/play overlay; no broken-image icon or alt-text fragment is exposed.
4. YouTube thumbnails use `object-fit: contain`, matching the site-wide no-destructive-cropping rule.
5. The nginx and API CSP definitions are synchronized to allow only the two required YouTube resource classes: `https://i.ytimg.com` for images, and `https://www.youtube.com` / `https://www.youtube-nocookie.com` for frames.
6. A narrow `media-security` Release Manager target updates only the nginx CSP file and the API CSP helper. It does not resync the wider server library.

## Local acceptance evidence

- Forced-thumbnail-failure preview, mobile 390×844: base customer photo `1600×1200`, thumbnail `0×0` and opacity `0`, play overlay present, horizontal overflow `0`.
- Normal-thumbnail preview, mobile 390×844: thumbnail `480×360`, `is-ready`, opacity `1`, `object-fit: contain`, horizontal overflow `0`.
- Normal-thumbnail preview, desktop 1512×827: thumbnail `480×360`, opacity `1`, `object-fit: contain`, horizontal overflow `0`.
- Homepage matrix passed for desktop and mobile in English, Chinese, French and Arabic; Arabic remained RTL and all eight cells had zero visible broken images and zero horizontal overflow.
- 40 focused Node tests passed.
- The PWA/install regression script passed with zero failures after its stale cache-key, manifest-mode and service-worker mocks were aligned with the existing guarded browser-mode implementation; no production PWA behavior was changed.
- Five inventory-public Python tests passed without modifying inventory.
- The current production critical-URL verifier passed all 17 homepage, catalog, API, lead, admin, login and portal checks.
- SEO boundary test confirmed title, description, canonical and JSON-LD remained byte-equivalent to the current commit aside from cache-key references.

## Scope and rollback

### Display release

- Site-wide HTML cache keys
- `css/visual-consistency-v1.css`
- `js/home-v4-hybrid.js`
- `js/half-cut-directory.js`
- Shared version constants and release assertions

Rollback: Release Manager snapshot of the exact visual manifest.

### Media security release

- `deploy/nginx-security.conf`
- `server/lib/security-paths.js`

Rollback: exact remote-file snapshot plus data-only backup; validate with `nginx -t`, reload nginx, restart the inventory API and verify public headers/API health.

## Explicit non-changes

- No inventory record, upload, photo order, video URL, price, status, supplier, enquiry logic, page URL, SEO title, description, canonical or JSON-LD content is changed.
- Original customer evidence photos and videos remain unchanged.
- The existing known Cloudflare TTL exception is not altered.

## Deployment gate

Required order: CEO approval → commit → GitHub push → `media-security` Release Manager release → `visual-v1` Release Manager release → production browser matrix and inventory hash comparison.
