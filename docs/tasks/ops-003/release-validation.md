# OPS-003 Release Validation

Parser-based public validation (not HTTP-200-only).

| Field | Value |
|---|---|
| release_id | OPS003-DRYRUN |
| status | fail |
| base_url | https://asia-power.com |
| expected_whatsapp | 8616638801930 |

Failed checks: 5

- FAIL `config_js_whatsapp`: bare /js/config.js whatsapp='233540911111' (expected 8616638801930) — likely Cloudflare cache poison
- FAIL `config_js_forbidden`: forbidden legacy WhatsApp still in bare config.js
- FAIL `config_js_cache_policy`: dangerous Cache-Control on config.js: public, max-age=31536000, immutable (APCONTACT incident class)
- FAIL `sw_precache_config`: sw.js still precaches bare /js/config.js (CF poison risk)
- FAIL `sw_cache_policy`: dangerous Cache-Control on sw.js: public, max-age=31536000, immutable
