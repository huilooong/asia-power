# Reports Audit

Audit date: 2026-07-04

## Valuable Reports

These reports/data files contain durable business or operational value:

- `asia-power-traffic-report-2026-07-04.md`: full traffic analysis with operational recommendations.
- `asia-power-traffic-weekly-2026-07-04.md`: automated weekly KPI summary.
- `analytics-daily-latest.csv`, `analytics-top-pages.csv`, `analytics-daily-2026-06-20-to-2026-07-04.csv`: source data for analytics.
- `asia-power-action-plan-standard-2026-07-04.md`: 30-day operating action plan tied to traffic report.
- `customer-data-export-2026-07-04.md`: customer/contact export summary.
- `customer-contact-leads-2026-07-04.csv`: website/contact leads.
- `customer-outreach-queue-2026-07-04.csv`: outreach queue, high business value but sensitive.
- `market-intel-aggregate.json`: aggregated verified market intelligence.
- `morning-engine-demand-2026-07-04.md`: verified morning engine demand report.
- `qxb-approved-import.json`: major inventory import output.
- `qxb-batch-progress.json`, `qxb-batch-reupload-summary.json`: useful operational state for QXB backlog.
- `qxb-vin-ocr-results.csv`: useful VIN OCR output.
- `qxb-untranslated-models.md`, `qxb-untranslated-models.csv`: vehicle localization backlog.

## Test / Temporary / Low-Value Artifacts

- `qxb-preview-row-*.html` and `qxb-preview-row-*/index.html`: preview artifacts.
- `qxb-approved-import.dryrun.json`, `qxb-approved-import.upload-test.json`: test outputs.
- `qxb-vin-ocr-results.sample.csv`, `qxb-vin-ocr-probe.csv`: samples/probes.
- `chassis-blur-batch.json`: one batch result; useful only until redaction issue closes.
- `apapp_001_report.md`: historical PWA implementation report.
- `morning-report.log`, `africa-maps-aggressive.log`: transient logs.
- `qxb-batch-upload.log`, `qxb-batch-upload-retry.log`, `qxb-batch-reupload-all.log`, `qxb-vin-ocr-full.log`, `qxb-vin-retrain-retry.log`: debugging logs; keep only while diagnosing.

## Explicitly Obsolete Reports

- `middle-east-africa-halfcut-market-2026-07-04.md`: marked obsolete due to unverified assumptions.
- `africa-me-halfcut-intelligence-2026-07-04.md`: marked obsolete; points to morning report.

## Sensitive / High-Risk Reports

- `customer-outreach-queue-2026-07-04.csv`: emails/phones and outreach intent.
- `customer-contact-leads-2026-07-04.csv`: customer contact info.
- `fb-daily-run-latest.json`, `fb-aggressive-20260704-0127.log`, `fb-friend-dm-batch1.log`: social account operational traces.
- `qxb-site-upload-state.json`: upload URLs/access state.

## Recommendation

Split `reports/` into:

- `reports/business/`
- `reports/analytics/`
- `reports/qxb/`
- `reports/logs/`
- `reports/previews/`
- `reports/archive/obsolete/`

Do not delete yet. First add a retention policy and move only after backup.

