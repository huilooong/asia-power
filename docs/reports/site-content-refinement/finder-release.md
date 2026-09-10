# Engine finder and site content release

Status: deployed and revalidated. Final release: `REL-20260910074457-site-content-a0751df97`.

## Deliverables

- `guides/engines/index.html`: brand → model → code/keyword finder, normalized code search, URL-persisted filters, 24-result increments, empty/reset states.
- `guides/engines/*.html`: 473 source-backed articles, return-to-results link and model-related article ordering.
- Previously reviewed homepage content entry, footer/readability, image orientation, translation and title repairs.
- `engine-guides-sitemap.xml` and `server/lib/sitemap.js`: complete discovery of the published guides.
- `scripts/engine_directory.py`, `scripts/build-engine-guides.py`: reproducible content build.
- `scripts/deploy-site-content.mjs`, `scripts/site-content-manifest.json`: scoped Release Manager deployment, baseline/staged/installed SHA-256 checks, full backup, exact originals and restore command.

Workspace: `/Users/longhui/Desktop/AsiaPower-site-content-20260910`.
Preview: http://127.0.0.1:8875/guides/engines/?brand=Audi
Production destination: https://asia-power.com/guides/engines/?brand=Audi

## Evidence tree

```
docs/reports/site-content-refinement/
  finder-release.md
  finder-validation.json
  finder-390.png
  finder-768.png
  finder-1440.png
  content-validation.json
  responsive-validation.json
```

## Validation

473 articles indexed; 474 dedicated sitemap URLs. Source keys, canonical URLs, article H1 and JSON-LD checked. Finder tested at 390/768/1440 pixels: brand count, dependent model options, code normalization, no-match state, clearing, pagination, URL reload and article return. No page errors or page-width overflow. Prior site changes rechecked across 56 page/width/language combinations with no failures. Nested sitemap test passes.

## Deployment and rollback

User authorized deployment and layout refinement in the current turn. Only differing public content and the sitemap module enter the manifest; no inventory/customer data is deployed. Release Manager enforces clean committed and pushed sources, backup, release ID, service checks and public URL checks. The exact original files are retained; newly introduced files can be moved into the release's withdrawn directory during rollback. The service is restarted to load the sitemap module.

## Remaining limits

The catalogue is a sourced subset, not an exhaustive China homologation register. English engine article bodies remain English. Grouped/ambiguous engine-code source records are not silently assigned to individual model years. Suggested next work: resolve these remaining application records against manufacturer sources.

## Follow-up verification

The first production release is REL-20260910074038-site-content-e42c4228c (486 files, validation passed). A follow-up narrows model options to the selected VAG brand and updates language-script query versions on 239 public pages, using current production HTML as the base. This addresses an observed immutable cached path-utils.js response; the new query URL was verified to serve the updated script. Hidden directories, admin and private portal directories are excluded.

## Final production verification

All seven critical public URLs returned HTTP 200 with current content. Finder flow passed in production at 390/768/1440px. Shared language script references on homepage, product detail, contact and Audi brand pages serve the new version. The first post-restart HTTP check encountered transient 502 responses; the original failures and later successful verification are both retained in the release record. Services are running with NRestarts=0.

Production screenshots: `finder-390-live.png`, `finder-768-live.png`, `finder-1440-live.png`. No further deployment is needed for the final report and the local release-helper improvement (skip unnecessary service restart for static-only releases).
