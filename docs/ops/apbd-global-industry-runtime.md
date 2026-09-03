# APBD global industry runtime

## Deployed behavior

`apbd-global-industry.service` is the single server-side discovery and research worker. It replaces the Canada-only discovery daemon while preserving the same durable APBD company database and the same single-flight lock.

Each iteration performs one small, load-gated unit of work:

1. Select a market through weighted priority: Canada first and most frequent, Venezuela second, United States and Mexico next, then the wider global list.
2. Select exactly one of six mutually exclusive development targets: parts wholesaler, export dealer, repair workshop, fleet operator, retail parts store, or regional dealer.
3. Discover public business candidates without browser UI or paid-provider activation.
4. Add and score candidates in the APBD solo-trade campaign workspace.
5. Deduplicate and synchronize them into the canonical APBD company repository.
6. Research official websites, retain email and decision-role evidence when observed, apply native contact validation, and classify primary activity only from first-party evidence.
7. Write a per-run country/industry report and durable cumulative state.

The worker also takes a small website-enrichment backlog from the selected country. This makes the first-priority Canada turns improve the existing Canadian base instead of treating a telephone number or website alone as outreach-ready.

## Safety boundary

- Ghana is excluded from discovery, research and outreach.
- The global worker cannot create outreach drafts or send email.
- Its auto-send country allowlist is empty.
- Canada and Venezuela are merely tagged for their separate CASL and sanctions-aware send gates. This worker never satisfies or bypasses those gates.
- Every email found through Maps, directories, OSM or other third-party discovery remains non-sendable. Only an official-site observation is recorded as first-party evidence, and even that remains blocked until all country and message requirements pass.
- An importer is never classified as an export dealer unless the official website explicitly describes export activity.
- The worker does not change advertising, budgets, payment systems or public website behavior.

## Runtime paths

- Config: `config/apbd_global_industry.yaml`
- State: `runtime/apbd/global_industry/state.json`
- Reports: `runtime/apbd/global_industry/reports/`
- Campaigns: `runtime/apbd/solo_trade/campaigns/`
- Canonical companies: `runtime/apbd/leads/db/companies.json`
- Shared lock: `runtime/apbd/leads/trickle.lock`

## Validation

```bash
.venv/bin/python3 scripts/apbd_global_industry_runner.py --dry-run
.venv/bin/python3 -m pytest -q tests/test_apbd_global_industry.py
systemctl is-active apbd-global-industry.service
systemctl is-enabled apbd-global-industry.service
systemctl is-active apbd-ca-leads-trickle.service # expected: inactive
```

## Recovery

The legacy unit is retained but disabled. To roll back the scheduler without deleting data:

```bash
systemctl disable --now apbd-global-industry.service
systemctl enable --now apbd-ca-leads-trickle.service
```

No CRM data rollback is implicit. Release Manager snapshots the new config, worker, unit, state and canonical company database before deployment.
