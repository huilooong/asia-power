# OPS-003 Release Validation

Parser-based public validation (not HTTP-200-only).

| Field | Value |
|---|---|
| release_id | REL-20260822055006-visual-v1-ebca4bf11 |
| status | fail |
| base_url | https://asia-power.com |
| expected_whatsapp | 8616638801930 |

Failed checks: 6

- FAIL `homepage_logo`: logo signal not found
- FAIL `config_js_cache_policy`: config.js must be short-lived (max-age=60); got: public, max-age=14400, must-revalidate
- FAIL `config_js_release_id`: config releaseId=REL-20260812051532-used-cars-5f5b418f0 != deploy REL-20260822055006-visual-v1-ebca4bf11
- FAIL `components_js_cache_policy`: /js/components.js must be short-lived (max-age=60); got: public, max-age=14400, must-revalidate
- FAIL `pwa_app_shell_js_cache_policy`: /js/pwa-app-shell.js must be short-lived (max-age=60); got: public, max-age=14400, must-revalidate
- FAIL `sw_cache_policy`: sw.js must be short-lived (max-age=60); got: public, max-age=14400, must-revalidate
