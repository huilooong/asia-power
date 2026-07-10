# AsiaPower Project Status Summary

Source: completed Project Status Scan only.

This summary reflects the repository state captured by `docs/cto/project-status-scan.md`. It does not introduce new architecture, redesign modules, or infer from memory.

## 1. Existing Agents

### Active

- **APCOO**
  - Role file: `constitution/roles/apcoo.md`
  - Profile: `profiles/coo.yaml`
  - Runtime evidence: `coo_core/`, `runtime/service.py`
  - Service evidence: `deploy/apcoo.service`, `ops/launchd/ai.asiapower.apcoo-bot.plist`
  - Telegram evidence: `integrations/telegram_coo_bot.py`, `integrations/telegram_coo_handler.py`
  - Test evidence: APCOO ops, deploy service, Telegram COO tests

- **APSales**
  - Role file: `constitution/roles/apsales.md`
  - Profile: `profiles/apsales.yaml`
  - Runtime evidence: `apsales_runtime/`
  - Service evidence: `deploy/apsales-runtime.service`, APSales launchd files
  - Telegram evidence: `integrations/telegram_apsales_bot.py`
  - Test evidence: APSales platform, role, runtime, opportunity, Telegram, sales intelligence tests

- **APInventory**
  - Role file: `constitution/roles/apinventory.md`
  - Profile: `profiles/apinventory.yaml`
  - Runtime / workflow evidence: inventory scripts, QXB upload scripts, inventory site files
  - Service evidence: `deploy/inventory-site.service`
  - Test evidence: `tests/test_apinventory_agent.py`

### Partial

- **APCGO**
  - Product architecture exists under `docs/product/apcgo/`
  - Agent documents exist under `docs/agents/apcgo/`
  - Related growth runtime evidence exists through `scripts/apsales-growth-autopilot.py`
  - No dedicated `agents/apcgo/runtime.py` was found in the completed scan

- **APBD**
  - Role file exists: `constitution/roles/apbd.md`
  - Runtime code exists under `agents/apbd/`
  - Product direction overlaps with APCGO
  - No profile file was confirmed by the scan

- **APSEO**
  - Product documents exist under `docs/product/seo/`
  - SEO script evidence exists, including `scripts/sync-seo-static-meta.mjs`
  - No dedicated `agents/apseo/runtime.py` was found in the completed scan

- **WHATSAPP**
  - Profile evidence exists: `profiles/whatsapp.yaml`
  - Connector / watcher evidence exists
  - Multiple WhatsApp tests exist
  - Status remains partial because it is not represented as a full named agent with role/profile/runtime/service parity

## 2. Existing Runtime Components

The scan confirmed these runtime components:

- **Event Bus**
  - Evidence: `apsales_runtime/events.py`

- **Scheduler / worker behavior**
  - Evidence: `apsales_runtime/scheduler.py`, `runtime/heartbeat.py`, `apsales_runtime/worker.py`

- **Task Queue**
  - Evidence: `apsales_runtime/task_queue.py`, `tools/task_tool.py`

- **MemoryStore / memory tooling**
  - Evidence: `apsales_runtime/memory.py`, `tools/memory_tool.py`, `memory/`

- **Approval system**
  - Evidence: `coo_core/approval_gate.py`, `agents/approval_router.py`, `customer_gateway/approval_notification.py`

- **Dispatcher / routing**
  - Evidence: `coo_core/dispatcher.py`, `coo_core/cli_router.py`, `agents/router.py`

- **CLI**
  - Evidence: `main.py`, `coo_core/cli_router.py`

- **Telegram bots**
  - Evidence: `integrations/telegram_coo_bot.py`, `integrations/telegram_apsales_bot.py`

- **Healthcheck**
  - Evidence: `runtime/healthcheck.py`, `coo_core/health_check.py`, `apsales_runtime/healthcheck.py`

- **Heartbeat**
  - Evidence: `runtime/heartbeat.py`, `apsales_runtime/worker.py`

## 3. Existing Architecture

The scan confirmed architecture documents and evidence for:

- **APCOO**
  - Existing architecture overview, executive summary, APCOO product audit, baseline ops audit, and runtime references.

- **APSales**
  - APSales runtime architecture, sales intelligence, opportunity model, customer lifecycle, sales pipeline, playbook, and related CTO documents.

- **APCGO / APBD**
  - APCGO product architecture exists.
  - APBD MVP, runner, lead discovery, keyword finder, competitor finder, mission planner, and daily execution documents exist.

- **APSEO**
  - APSEO 90-day roadmap, execution plan, KPI, review, SEO-009, SEO-010, SEO-011, and Engine Intelligence architecture documents exist.

- **APInventory**
  - Inventory source model, inventory agent role/profile, QXB workflows, and inventory site/service evidence exist.

- **Knowledge Graph / Knowledge Schema**
  - Engine knowledge schema exists.
  - Engine identity design exists.
  - Engine opportunity ranking and Engine Growth Engine documentation exist.

- **Runtime**
  - Shared runtime and APSales runtime both exist.

- **Memory**
  - Markdown/file memory and APSales runtime memory both exist.

- **Event Bus**
  - APSales runtime event module exists.

- **Release Manager**
  - Release manager discipline and production-impacting change documents exist.

- **Infrastructure**
  - Deployment, service, launchd, nginx, healthcheck, and production incident documentation exist.

## 4. Existing Product Modules

The scan confirmed these product/module areas:

- Website and SEO pages
- Engine Intelligence / Engine detail pages
- Knowledge schema and engine knowledge records
- APSales and sales intelligence
- APCOO operating architecture
- APInventory and inventory source workflows
- APCGO / APBD growth and business development documents
- APSEO Google traffic operating system documents
- Customer Gateway
- WhatsApp integration
- Email integration
- Facebook / growth automation references
- Analytics and reporting
- Release / deployment operations

## 5. Existing Deployment

Deployment-related evidence exists for:

- APCOO systemd service: `deploy/apcoo.service`
- APSales runtime service: `deploy/apsales-runtime.service`
- APInventory site service: `deploy/inventory-site.service`
- APCOO launchd service: `ops/launchd/ai.asiapower.apcoo-bot.plist`
- APSales launchd service files
- Release manager documentation
- Production incident / rollback / baseline audit documents

The scan did not execute deployment scripts and did not validate live deployment state.

## 6. Existing Tests

The scan confirmed tests covering:

- APCOO ops, service, planner, critic, reporter, dispatcher, and Telegram bot behavior
- APSales platform, role, runtime foundation, opportunity integration, sales intelligence, message classifier, and Telegram behavior
- APInventory agent behavior
- QXB import, upload, photo, and pricing workflows
- Runtime config, heartbeat, healthcheck, multi-agent behavior
- Telegram access and integrations
- WeCom access, callback, and group upload
- WhatsApp connector, importer, live adapter, business session, safety, polling, and sales intelligence reporting
- Email outbound, proxy, signature, filter, and webhook behavior
- Customer Gateway integration and approval notification
- Memory tool and customer memory rules
- Knowledge ingest behavior
- Language policy/router behavior
- Risk classifier and risk engine
- Audit, backup recovery, tool registry, task tool, truth guard, and draft queue areas

## 7. Existing Gaps

Gaps proven by the completed scan:

- APCGO has product documents, but no `agents/apcgo/runtime.py` was found.
- APSEO has product documents, but no `agents/apseo/runtime.py` was found.
- APCGO Growth Database is documented, but no `data/apcgo/` store was found.
- Two runtime foundations exist; the scan does not prove a single unified runtime owner.
- Two memory access patterns exist; the scan does not prove a unified memory source of truth.

## 8. Existing Duplicate Concepts

Duplicate or overlapping concepts proven by files:

- **Opportunity vs GrowthOpportunity**
  - APSales commercial opportunity model and APCGO pre-sales growth opportunity model both exist.

- **APCGO vs APBD**
  - APCGO product architecture and APBD code/docs both exist.

- **APSales Runtime vs APCOO Runtime**
  - APSales has `apsales_runtime/`.
  - APCOO/shared runtime exists under `runtime/` and `coo_core/`.

- **Knowledge Graph vs Growth Database**
  - Engine knowledge schema and APCGO growth database both define persistent intelligence objects.

- **MemoryStore vs markdown memory**
  - APSales runtime memory and markdown/file-based memory tooling both exist.

- **APCOO approval gate vs APSales/customer approval routing**
  - COO approval gate, generic approval router, and customer-gateway approval notification coexist.

- **Node analytics vs Python analytics reports**
  - Node site analytics and Python analytics/reporting modules both exist.

## 9. Current Development Priorities

Based only on repository evidence, current priorities are:

1. Define ownership boundaries for overlapping concepts before adding new architecture.
2. Clarify APCGO versus APBD before implementing or expanding growth runtime.
3. Clarify APSEO runtime ownership before building a dedicated APSEO agent.
4. Decide where APCGO GrowthOpportunity data should persist before daily automation.
5. Document runtime ownership between `runtime/` and `apsales_runtime/`.
6. Document memory ownership between markdown memory, `tools/memory_tool.py`, and `apsales_runtime/memory.py`.
7. Continue using the existing Release Manager discipline for production-impacting changes.

## 10. CTO Review Conclusion

AsiaPower is not a blank project. The repository already contains multiple active agents, runtime components, product architectures, deployment services, and tests.

The highest-risk area is not missing feature work. The highest-risk area is overlapping ownership across agents, runtime, memory, growth opportunities, and knowledge systems.

The next CTO-level decision should be ownership clarification before further runtime expansion.
