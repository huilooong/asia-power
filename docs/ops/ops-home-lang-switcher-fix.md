# OPS — Homepage language switcher fix

**Date:** 2026-07-10  
**Status:** Deployed & verified  
**Release:** REL-20260710055423-home-76489479

## Problem
1. Homepage had almost no `data-i18n` (only Sign in + title) — clicking EN/中文/FR/AR looked broken.
2. Dynamic shelves in `home-v4-hybrid.js` were hardcoded English and did not re-render on language change.
3. On mobile (~390px), category nav squeezed the language buttons off-screen so taps failed.

## Fix
- Added `home.v4.*` strings (ZH/FR/AR) in `js/public-i18n.js`
- Wired static homepage copy with `data-i18n` / `data-i18n-placeholder`
- `home-v4-hybrid.js` uses `PublicI18n.t()` and re-renders on `asiapower:langchange`
- Mobile nav: language row stays visible; category links wrap to second row
- `deploy:home` now also syncs `public-i18n.js` + `path-utils.js`
- Cache bust: `home-lang-v1`

## Validation
- Live: click 中文 → hero/nav/shelves/footer switch to Chinese; Sign in → 登录
- Live: click EN → restores English
- Mobile: language buttons remain in first nav row and are clickable

## Files
- `index.html`
- `js/public-i18n.js`
- `js/home-v4-hybrid.js`
- `js/path-utils.js`
- `css/home-v4-hybrid.css`
- `scripts/deploy-production.mjs`
