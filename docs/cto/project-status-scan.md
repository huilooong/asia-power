# AsiaPower Project Status Scan

Generated: `2026-07-05 07:23 UTC`

Source: repository filesystem scan only. No business scripts, network calls, runtime services, Telegram bots, Facebook scripts, or deployment commands were executed.

## 1. Existing Agents

| Agent | Role / constitution file | Profile file | Runtime entry | Telegram/systemd/launchd service | Tests | Current status |
| --- | --- | --- | --- | --- | --- | --- |
| APCOO | constitution/roles/apcoo.md | profiles/coo.yaml | coo_core/__init__.py<br>coo_core/approval_gate.py<br>coo_core/ceo_ops_briefing.py<br>coo_core/cli_router.py<br>coo_core/constitution_loader.py<br>coo_core/critic.py<br>coo_core/dispatcher.py<br>coo_core/health_check.py<br>coo_core/planner.py<br>coo_core/reporter.py | deploy/apcoo.service<br>integrations/telegram_coo_bot.py<br>integrations/telegram_coo_handler.py<br>ops/launchd/ai.asiapower.apcoo-bot.plist | tests/test_apcoo_ops_briefing.py<br>tests/test_deploy_apcoo_service.py<br>tests/test_telegram_coo_bot.py | active |
| APSales | constitution/roles/apsales.md | profiles/apsales.yaml | apsales_runtime/__init__.py<br>apsales_runtime/bootstrap.py<br>apsales_runtime/config.py<br>apsales_runtime/events.py<br>apsales_runtime/healthcheck.py<br>apsales_runtime/lifecycle.py<br>apsales_runtime/logging.py<br>apsales_runtime/memory.py<br>apsales_runtime/paths.py<br>apsales_runtime/recovery.py | deploy/apsales-runtime.service<br>deploy/launchd/com.asiapower.apsales.facebook-daily.plist<br>deploy/launchd/com.asiapower.apsales.zijing.plist<br>integrations/telegram_apsales_bot.py | tests/test_apsales_101_opportunity_integration.py<br>tests/test_apsales_platform.py<br>tests/test_apsales_role.py<br>tests/test_apsales_runtime_foundation.py<br>tests/test_sales_brain_draft.py<br>tests/test_sales_intelligence_engine.py<br>tests/test_sales_message_classifier.py<br>tests/test_sales_performance_analyzer.py<br>tests/test_telegram_apsales.py<br>tests/test_whatsapp_sales_intelligence_full_report.py | active |
| APInventory | constitution/roles/apinventory.md | profiles/apinventory.yaml | deploy/inventory-site-scripts/backup-inventory-site.sh<br>deploy/inventory-site-server.js<br>deploy/inventory-site.service<br>profiles/apinventory.yaml<br>profiles/inventory.yaml<br>scripts/fix-inventory-record.mjs<br>scripts/qxb-upload-approved-inventory.py<br>scripts/start-inventory-site-local.mjs<br>scripts/test-inventory-site-media.mjs | deploy/inventory-site.service | tests/test_apinventory_agent.py | active |
| APCGO | unknown from repo scan | unknown from repo scan | scripts/apsales-growth-autopilot.py | unknown from repo scan | tests/test_growth_autopilot.py | partial |
| APBD | constitution/roles/apbd.md | unknown from repo scan | agents/apbd/__init__.py<br>agents/apbd/competitor_finder.py<br>agents/apbd/config.py<br>agents/apbd/constitution.py<br>agents/apbd/draft_assets.py<br>agents/apbd/keyword_finder.py<br>agents/apbd/lead_finder.py<br>agents/apbd/mission_planner.py<br>agents/apbd/models.py<br>agents/apbd/runner.py | unknown from repo scan | unknown from repo scan | partial |
| APSEO | unknown from repo scan | unknown from repo scan | scripts/sync-seo-static-meta.mjs | unknown from repo scan | unknown from repo scan | partial |
| WHATSAPP | unknown from repo scan | profiles/whatsapp.yaml | profiles/whatsapp.yaml<br>scripts/telegram-whatsapp-inquiry-watch.js | scripts/telegram-whatsapp-inquiry-watch.js | tests/fixtures/sample_whatsapp_chat.txt<br>tests/test_whatsapp_analysis.py<br>tests/test_whatsapp_browser_adapter.py<br>tests/test_whatsapp_business_polling.py<br>tests/test_whatsapp_business_safety.py<br>tests/test_whatsapp_business_session.py<br>tests/test_whatsapp_business_web_connector.py<br>tests/test_whatsapp_connector_readonly.py<br>tests/test_whatsapp_importer.py<br>tests/test_whatsapp_live_adapter.py<br>tests/test_whatsapp_live_readonly.py<br>tests/test_whatsapp_safety.py | partial |

## 2. Existing Architecture Documents

### APCOO
- `docs/architecture/architecture-overview.md` — AsiaPower Architecture Overview
- `docs/architecture/executive_summary.md` — Executive Summary
- `docs/cto/apsales/apsales-100-sales-intelligence.md` — APSALES-100 — Sales Intelligence Platform
- `docs/cto/apsales-runtime-v1.md` — APSALES-001 — APSales Production Runtime v1
- `docs/cto/ops-002-baseline-audit.md` — OPS-002 Baseline Audit
- `docs/product/apcoo/apcoo-architecture-audit.md` — APCOO Architecture Audit

### APSales
- `docs/agents/apbd/browser-safety-fix.md` — APBD Browser Safety Fix
- `docs/agents/apbd/daily-execution.md` — APBD Daily Execution
- `docs/agents/apbd/executive-summary.md` — APBD Daily Executive Summary
- `docs/agents/apbd/integration-test-001.md` — APBD-TEST-001 — Integration Validation
- `docs/agents/apbd/lead-discovery.md` — APBD Lead Discovery
- `docs/agents/apbd/overview.md` — AsiaPower Business Development AI (APBD) MVP
- `docs/agents/apbd/runtime-mvp.md` — APBD Runtime MVP — Delivery Report
- `docs/agents/apbd/tool-001-leadfinder.md` — APBD-TOOL-001 — Lead Finder MVP
- `docs/agents/apbd/tool-004-missionplanner.md` — APBD-TOOL-004 — Mission Planner MVP
- `docs/agents/apbd/upgrade-001-mission-to-asset.md` — APBD-UPGRADE-001 — Mission → Asset
- `docs/agents/apcgo/future-roadmap.md` — APCGO Future Roadmap
- `docs/agents/apcgo/growth-playbook.md` — APCGO Growth Playbook
- `docs/agents/apcgo/overview.md` — AsiaPower Chief Growth Officer (APCGO)
- `docs/architecture/ai-engineering-standard-v1.md` — AsiaPower AI Engineering Standard v1.0
- `docs/architecture/architecture-overview.md` — AsiaPower Architecture Overview
- `docs/architecture/customer_gateway_audit.md` — Customer Gateway Audit
- `docs/architecture/executive_summary.md` — Executive Summary
- `docs/architecture/growth_map.md` — Growth Map
- `docs/architecture/integrations_audit.md` — Integrations Audit
- `docs/architecture/scripts-audit.md` — Scripts Audit

### APCGO / APBD
- `docs/agents/apbd/apbd-runner.md` — APBD-RUNNER-001 — Continuous Business Development Loop
- `docs/agents/apbd/browser-safety-fix.md` — APBD Browser Safety Fix
- `docs/agents/apbd/competitor-opportunities.md` — APBD Competitor Opportunities
- `docs/agents/apbd/constitution-001-traffic-first.md` — APBD-CONSTITUTION-001 — Traffic First
- `docs/agents/apbd/content-opportunities.md` — APBD Content Opportunities
- `docs/agents/apbd/daily-execution.md` — APBD Daily Execution
- `docs/agents/apbd/executive-summary.md` — APBD Daily Executive Summary
- `docs/agents/apbd/hotfix-001.md` — APBD-HOTFIX-001 — Task Order & Config Sync
- `docs/agents/apbd/integration-test-001.md` — APBD-TEST-001 — Integration Validation
- `docs/agents/apbd/lead-discovery.md` — APBD Lead Discovery
- `docs/agents/apbd/overview.md` — AsiaPower Business Development AI (APBD) MVP
- `docs/agents/apbd/runtime-mvp.md` — APBD Runtime MVP — Delivery Report
- `docs/agents/apbd/tool-001-leadfinder.md` — APBD-TOOL-001 — Lead Finder MVP
- `docs/agents/apbd/tool-002-keywordfinder.md` — APBD-TOOL-002 — Keyword Finder MVP
- `docs/agents/apbd/tool-003-competitorfinder.md` — APBD-TOOL-003 — Competitor Finder MVP
- `docs/agents/apbd/tool-004-missionplanner.md` — APBD-TOOL-004 — Mission Planner MVP
- `docs/agents/apbd/upgrade-001-mission-to-asset.md` — APBD-UPGRADE-001 — Mission → Asset
- `docs/agents/apcgo/daily-workflow.md` — APCGO Daily Workflow
- `docs/agents/apcgo/future-roadmap.md` — APCGO Future Roadmap
- `docs/agents/apcgo/growth-playbook.md` — APCGO Growth Playbook

### APSEO
- `docs/agents/apbd/competitor-opportunities.md` — APBD Competitor Opportunities
- `docs/agents/apbd/constitution-001-traffic-first.md` — APBD-CONSTITUTION-001 — Traffic First
- `docs/agents/apbd/content-opportunities.md` — APBD Content Opportunities
- `docs/agents/apbd/tool-003-competitorfinder.md` — APBD-TOOL-003 — Competitor Finder MVP
- `docs/agents/apcgo/daily-workflow.md` — APCGO Daily Workflow
- `docs/agents/apcgo/future-roadmap.md` — APCGO Future Roadmap
- `docs/agents/apcgo/growth-playbook.md` — APCGO Growth Playbook
- `docs/agents/apcgo/overview.md` — AsiaPower Chief Growth Officer (APCGO)
- `docs/architecture/ai-engineering-standard-v1.md` — AsiaPower AI Engineering Standard v1.0
- `docs/architecture/growth_map.md` — Growth Map
- `docs/architecture/scripts-audit.md` — Scripts Audit
- `docs/cto/apsales/apsales-100-sales-intelligence.md` — APSALES-100 — Sales Intelligence Platform
- `docs/cto/apsales-101-review.md` — APSALES-101 — Review Report (Revised)
- `docs/cto/incident-001-homepage-regression.md` — INCIDENT-001 — Homepage Content Regression
- `docs/cto/incident-002-mass-regression.md` — INCIDENT-002 — Mass Production Regression
- `docs/cto/incident-002-restore-filelist.txt` — incident-002-restore-filelist.txt
- `docs/cto/review/g4kd.json` — g4kd.json
- `docs/cto/seo-009-engine-page-optimization.md` — SEO-009 - Engine Landing Page Optimization
- `docs/cto/seo-010A-move-report.md` — SEO-010A Move Report
- `docs/product/apcgo/apcgo-architecture.md` — APCGO v1 Architecture

### APInventory
- `docs/agents/apbd/browser-safety-fix.md` — APBD Browser Safety Fix
- `docs/agents/apbd/executive-summary.md` — APBD Daily Executive Summary
- `docs/agents/apbd/runtime-mvp.md` — APBD Runtime MVP — Delivery Report
- `docs/agents/apbd/tool-004-missionplanner.md` — APBD-TOOL-004 — Mission Planner MVP
- `docs/agents/apcgo/future-roadmap.md` — APCGO Future Roadmap
- `docs/agents/apcgo/growth-playbook.md` — APCGO Growth Playbook
- `docs/agents/apcgo/overview.md` — AsiaPower Chief Growth Officer (APCGO)
- `docs/architecture/architecture-overview.md` — AsiaPower Architecture Overview
- `docs/architecture/executive_summary.md` — Executive Summary
- `docs/architecture/integrations_audit.md` — Integrations Audit
- `docs/architecture/reports-audit.md` — Reports Audit
- `docs/architecture/scripts-audit.md` — Scripts Audit
- `docs/cto/apsales/apsales-100-sales-intelligence.md` — APSALES-100 — Sales Intelligence Platform
- `docs/cto/apsales/playbook-v1.md` — Sales Playbook & Intelligence v1
- `docs/cto/apsales-102-analysis.md` — APSALES-102 — Architecture Analysis (Revised)
- `docs/cto/apsales-runtime-v1.md` — APSALES-001 — APSales Production Runtime v1
- `docs/cto/engine-detail-v2-spec.md` — Engine Detail Page V2 Spec
- `docs/cto/incident-002-mass-regression.md` — INCIDENT-002 — Mass Production Regression
- `docs/cto/ops-001-nginx-analysis.md` — OPS-001 — Nginx `asiapower_upload` Zone Analysis
- `docs/cto/ops-002-baseline-audit.md` — OPS-002 Baseline Audit

### Knowledge Graph
- `docs/cto/apsales/apsales-100-sales-intelligence.md` — APSALES-100 — Sales Intelligence Platform
- `docs/cto/apsales/customer-lifecycle-v1.md` — Customer Lifecycle v1
- `docs/cto/apsales/opportunity-model-v1.md` — Opportunity Model v1
- `docs/cto/apsales/playbook-v1.md` — Sales Playbook & Intelligence v1
- `docs/cto/apsales/sales-pipeline-v1.md` — Sales Pipeline v1
- `docs/cto/apsales-101-analysis.md` — APSALES-101 — Architecture Analysis (Revised)
- `docs/cto/incident-002-mass-regression.md` — INCIDENT-002 — Mass Production Regression
- `docs/cto/review/TASK-003A-DELIVERY.md` — TASK-003A Delivery Review
- `docs/cto/review/engine.schema.json` — engine.schema.json
- `docs/cto/review/knowledge-schema.md` — Engine Knowledge Schema
- `docs/cto/task-003A-schema.md` — task-003A-schema.md
- `docs/cto/task-004.md` — TASK-004 - Engine Page Factory V1
- `docs/cto/task-005.md` — TASK-005 - AsiaPower Engine Growth Engine V1
- `docs/product/apcgo/apcgo-architecture-audit.md` — APCGO Architecture Audit
- `docs/product/apcoo/apcoo-architecture-audit.md` — APCOO Architecture Audit
- `docs/product/seo/apseo-011-roadmap.md` — APSEO-011 Roadmap
- `knowledge/schema/engine.schema.json` — engine.schema.json

### Runtime
- `docs/agents/apbd/apbd-runner.md` — APBD-RUNNER-001 — Continuous Business Development Loop
- `docs/agents/apbd/browser-safety-fix.md` — APBD Browser Safety Fix
- `docs/agents/apbd/hotfix-001.md` — APBD-HOTFIX-001 — Task Order & Config Sync
- `docs/agents/apbd/integration-test-001.md` — APBD-TEST-001 — Integration Validation
- `docs/agents/apbd/runtime-mvp.md` — APBD Runtime MVP — Delivery Report
- `docs/agents/apbd/tool-001-leadfinder.md` — APBD-TOOL-001 — Lead Finder MVP
- `docs/agents/apbd/tool-002-keywordfinder.md` — APBD-TOOL-002 — Keyword Finder MVP
- `docs/agents/apbd/tool-003-competitorfinder.md` — APBD-TOOL-003 — Competitor Finder MVP
- `docs/agents/apbd/tool-004-missionplanner.md` — APBD-TOOL-004 — Mission Planner MVP
- `docs/agents/apbd/upgrade-001-mission-to-asset.md` — APBD-UPGRADE-001 — Mission → Asset
- `docs/architecture/architecture-overview.md` — AsiaPower Architecture Overview
- `docs/architecture/executive_summary.md` — Executive Summary
- `docs/architecture/growth_map.md` — Growth Map
- `docs/architecture/integrations_audit.md` — Integrations Audit
- `docs/architecture/scripts-audit.md` — Scripts Audit
- `docs/cto/apsales/apsales-100-sales-intelligence.md` — APSALES-100 — Sales Intelligence Platform
- `docs/cto/apsales/customer-lifecycle-v1.md` — Customer Lifecycle v1
- `docs/cto/apsales/dashboard-v1.md` — CEO Dashboard v1
- `docs/cto/apsales/opportunity-model-v1.md` — Opportunity Model v1
- `docs/cto/apsales/playbook-v1.md` — Sales Playbook & Intelligence v1

### Memory
- `docs/architecture/architecture-overview.md` — AsiaPower Architecture Overview
- `docs/architecture/customer_gateway_audit.md` — Customer Gateway Audit
- `docs/architecture/growth_map.md` — Growth Map
- `docs/architecture/integrations_audit.md` — Integrations Audit
- `docs/architecture/scripts-audit.md` — Scripts Audit
- `docs/cto/apsales/apsales-100-sales-intelligence.md` — APSALES-100 — Sales Intelligence Platform
- `docs/cto/apsales/customer-lifecycle-v1.md` — Customer Lifecycle v1
- `docs/cto/apsales/opportunity-model-v1.md` — Opportunity Model v1
- `docs/cto/apsales/playbook-v1.md` — Sales Playbook & Intelligence v1
- `docs/cto/apsales-101-analysis.md` — APSALES-101 — Architecture Analysis (Revised)
- `docs/cto/apsales-102-analysis.md` — APSALES-102 — Architecture Analysis (Revised)
- `docs/cto/apsales-102-review.md` — APSALES-102 — Architecture Review (Approved)
- `docs/cto/apsales-runtime-v1.md` — APSALES-001 — APSales Production Runtime v1
- `docs/cto/ops-001-nginx-analysis.md` — OPS-001 — Nginx `asiapower_upload` Zone Analysis
- `docs/cto/ops-002-baseline-audit.md` — OPS-002 Baseline Audit
- `docs/cto/ops-002a-root-cause.md` — OPS-002A — Root Cause Investigation
- `docs/cto/ops-003-drift-elimination.md` — OPS-003 — Eliminate Configuration Drift
- `docs/cto/task-004.md` — TASK-004 - Engine Page Factory V1
- `docs/cto/task-005.md` — TASK-005 - AsiaPower Engine Growth Engine V1
- `docs/cto/task-008-deploy-final.md` — TASK-008 Deploy Final

### Event Bus
- `docs/agents/apbd/runtime-mvp.md` — APBD Runtime MVP — Delivery Report
- `docs/cto/apsales/apsales-100-sales-intelligence.md` — APSALES-100 — Sales Intelligence Platform
- `docs/cto/apsales/customer-lifecycle-v1.md` — Customer Lifecycle v1
- `docs/cto/apsales/opportunity-model-v1.md` — Opportunity Model v1
- `docs/cto/apsales/playbook-v1.md` — Sales Playbook & Intelligence v1
- `docs/cto/apsales/sales-pipeline-v1.md` — Sales Pipeline v1
- `docs/cto/apsales-101-analysis.md` — APSALES-101 — Architecture Analysis (Revised)
- `docs/cto/apsales-101-implementation.md` — APSALES-101 — Implementation Report
- `docs/cto/apsales-101-review-final.md` — APSALES-101 — Final CTO Review
- `docs/cto/apsales-101-review.md` — APSALES-101 — Review Report (Revised)
- `docs/cto/apsales-101-test-plan.md` — APSALES-101 — Integration Test Plan
- `docs/cto/apsales-101-validation.md` — APSALES-101 — Validation Report
- `docs/cto/apsales-102-analysis.md` — APSALES-102 — Architecture Analysis (Revised)
- `docs/cto/apsales-102-review.md` — APSALES-102 — Architecture Review (Approved)
- `docs/cto/apsales-runtime-v1.md` — APSALES-001 — APSales Production Runtime v1
- `docs/product/apcgo/apcgo-architecture-audit.md` — APCGO Architecture Audit
- `docs/product/apcoo/apcoo-architecture-audit.md` — APCOO Architecture Audit

### Release Manager
- `docs/architecture/ai-engineering-standard-v1.md` — AsiaPower AI Engineering Standard v1.0
- `docs/architecture/architecture-overview.md` — AsiaPower Architecture Overview
- `docs/architecture/scripts-audit.md` — Scripts Audit
- `docs/cto/apsales/apsales-100-sales-intelligence.md` — APSALES-100 — Sales Intelligence Platform
- `docs/cto/apsales-101-review-final.md` — APSALES-101 — Final CTO Review
- `docs/cto/apsales-101-test-plan.md` — APSALES-101 — Integration Test Plan
- `docs/cto/apsales-102-review.md` — APSALES-102 — Architecture Review (Approved)
- `docs/cto/apsales-runtime-v1.md` — APSALES-001 — APSales Production Runtime v1
- `docs/cto/incident-001-homepage-regression.md` — INCIDENT-001 — Homepage Content Regression
- `docs/cto/incident-002-mass-regression.md` — INCIDENT-002 — Mass Production Regression
- `docs/cto/ops-001-nginx-analysis.md` — OPS-001 — Nginx `asiapower_upload` Zone Analysis
- `docs/cto/ops-002-baseline-audit.md` — OPS-002 Baseline Audit
- `docs/cto/ops-002a-root-cause.md` — OPS-002A — Root Cause Investigation
- `docs/cto/ops-003-drift-elimination.md` — OPS-003 — Eliminate Configuration Drift
- `docs/cto/ops-004-phase1.md` — OPS-004 Phase 1 — Done
- `docs/cto/ops-005-release-manager.md` — OPS-005 — Release Manager
- `docs/cto/task-008-deploy-final.md` — TASK-008 Deploy Final
- `docs/product/apcgo/apcgo-architecture-audit.md` — APCGO Architecture Audit

### Infrastructure
- `docs/agents/apbd/apbd-runner.md` — APBD-RUNNER-001 — Continuous Business Development Loop
- `docs/agents/apbd/constitution-001-traffic-first.md` — APBD-CONSTITUTION-001 — Traffic First
- `docs/agents/apbd/content-opportunities.md` — APBD Content Opportunities
- `docs/agents/apbd/daily-execution.md` — APBD Daily Execution
- `docs/agents/apbd/executive-summary.md` — APBD Daily Executive Summary
- `docs/agents/apbd/overview.md` — AsiaPower Business Development AI (APBD) MVP
- `docs/agents/apbd/runtime-mvp.md` — APBD Runtime MVP — Delivery Report
- `docs/agents/apbd/tool-001-leadfinder.md` — APBD-TOOL-001 — Lead Finder MVP
- `docs/agents/apbd/tool-004-missionplanner.md` — APBD-TOOL-004 — Mission Planner MVP
- `docs/agents/apbd/upgrade-001-mission-to-asset.md` — APBD-UPGRADE-001 — Mission → Asset
- `docs/agents/apcgo/daily-workflow.md` — APCGO Daily Workflow
- `docs/agents/apcgo/future-roadmap.md` — APCGO Future Roadmap
- `docs/agents/apcgo/growth-playbook.md` — APCGO Growth Playbook
- `docs/agents/apcgo/overview.md` — AsiaPower Chief Growth Officer (APCGO)
- `docs/architecture/ai-engineering-standard-v1.md` — AsiaPower AI Engineering Standard v1.0
- `docs/architecture/architecture-overview.md` — AsiaPower Architecture Overview
- `docs/architecture/executive_summary.md` — Executive Summary
- `docs/architecture/growth_map.md` — Growth Map
- `docs/architecture/integrations_audit.md` — Integrations Audit
- `docs/architecture/scripts-audit.md` — Scripts Audit

## 3. Existing Runtime Components

| Component | Status | Evidence |
| --- | --- | --- |
| Event Bus | present | `apsales_runtime/events.py`<br>`docs/cto/apsales-runtime-v1.md` |
| Scheduler | present | `apsales_runtime/scheduler.py`<br>`runtime/heartbeat.py`<br>`docs/cto/apsales-runtime-v1.md`<br>`README-AI-OS.md` |
| Task Queue | present | `apsales_runtime/task_queue.py`<br>`tools/task_tool.py`<br>`README-AI-OS.md` |
| MemoryStore | present | `apsales_runtime/memory.py`<br>`tools/memory_tool.py`<br>`README-AI-OS.md`<br>`docs/cto/apsales-runtime-v1.md` |
| approval system | present | `coo_core/approval_gate.py`<br>`agents/approval_router.py`<br>`README-AI-OS.md` |
| dispatcher | present | `coo_core/dispatcher.py`<br>`coo_core/cli_router.py`<br>`agents/router.py`<br>`README-AI-OS.md` |
| CLI | present | `main.py`<br>`coo_core/cli_router.py`<br>`README-AI-OS.md` |
| Telegram bots | present | `integrations/telegram_coo_bot.py`<br>`integrations/telegram_apsales_bot.py`<br>`README-AI-OS.md` |
| healthcheck | present | `runtime/healthcheck.py`<br>`coo_core/health_check.py`<br>`apsales_runtime/healthcheck.py`<br>`README-AI-OS.md` |
| heartbeat | present | `runtime/heartbeat.py`<br>`apsales_runtime/worker.py`<br>`README-AI-OS.md`<br>`docs/cto/apsales-runtime-v1.md` |

## 4. Existing Data Stores

| Store | Status | Directories | Files | Top-level entries |
| --- | --- | --- | --- | --- |
| `data/` | present | 596 | 7791 | `.DS_Store`<br>`.gitkeep`<br>`apsales_runtime/`<br>`half-cut-approved.json`<br>`half-cut-approved.json.bak`<br>`half-cut-submissions.json`<br>`knowledge-base/`<br>`message_log.jsonl`<br>`qxb-photos/`<br>`qxb-photos-sample/`<br>`qxb-photos-test/`<br>`qxb-vin-last2-probe/`<br>`qxb-vin-photo-sample30/`<br>`users.json`<br>`vehicle-model-memory.json` |
| `memory/` | present | 322 | 14880 | `2026-06-25.md`<br>`2026-06-29.md`<br>`2026-07-01.md`<br>`2026-07-02.md`<br>`2026-07-03.md`<br>`2026-07-04.md`<br>`agent_notes/`<br>`apcoo-bot.log`<br>`approvals/`<br>`company/`<br>`constitution/`<br>`conversations/`<br>`customer_gateway/`<br>`customers/`<br>`customers.md`<br>`daily_logs/`<br>`decisions/`<br>`decisions.md`<br>`index.json`<br>`knowledge/` |
| `knowledge/` | present | 2 | 2 | `engines/`<br>`schema/` |
| `reports/` | present | 12 | 89 | `africa-maps-aggressive.log`<br>`africa-me-halfcut-intelligence-2026-07-04.md`<br>`analytics-daily-2026-06-20-to-2026-07-04.csv`<br>`analytics-daily-latest.csv`<br>`analytics-top-pages.csv`<br>`apapp_001_report.md`<br>`asia-power-action-plan-standard-2026-07-04.md`<br>`asia-power-traffic-report-2026-07-04.md`<br>`asia-power-traffic-weekly-2026-07-04.md`<br>`chassis-blur-batch.json`<br>`customer-contact-leads-2026-07-04.csv`<br>`customer-data-export-2026-07-04.md`<br>`customer-outreach-queue-2026-07-04.csv`<br>`fb-aggressive-20260704-0127.log`<br>`fb-daily-run-latest.json`<br>`fb-friend-dm-batch1.log`<br>`market-intel-aggregate.json`<br>`middle-east-africa-halfcut-market-2026-07-04.md`<br>`morning-engine-demand-2026-07-04.md`<br>`morning-report.log` |
| `audit/` | present | 0 | 6 | `__init__.py`<br>`approvals.jsonl`<br>`errors.jsonl`<br>`events.jsonl`<br>`logger.py`<br>`tool_calls.jsonl` |
| `docs/` | present | 51 | 392 | `.DS_Store`<br>`admin-leads-runbook.md`<br>`agents/`<br>`architecture/`<br>`asia-power-v3-blueprint.md`<br>`backups/`<br>`brand-v3/`<br>`claude-template/`<br>`cto/`<br>`engine-opportunity-ranking.md`<br>`f11-launchpad-ceo-guide.md`<br>`half-cut-backend-mapping.md`<br>`inventory-source-model.md`<br>`ipad-sidecar-ceo-guide.md`<br>`knowledge-identity-design.md`<br>`knowledge-schema.md`<br>`launchpad-f9-ceo-guide.md`<br>`mobile/`<br>`ops/`<br>`preview-hub.html` |

## 5. Existing Tests

### APCOO bot/runtime/ops behavior
- `tests/test_apcoo_ops_briefing.py`
- `tests/test_deploy_apcoo_service.py`

### APInventory agent behavior
- `tests/test_apinventory_agent.py`

### APSales Opportunity integration
- `tests/test_apsales_101_opportunity_integration.py`

### APSales role/platform/sales behavior
- `tests/test_apsales_platform.py`
- `tests/test_apsales_role.py`
- `tests/test_telegram_apsales.py`

### APSales runtime foundation
- `tests/test_apsales_runtime_foundation.py`

### COO critic rules
- `tests/test_critic.py`

### COO planner
- `tests/test_planner.py`

### COO reporter
- `tests/test_reporter.py`

### QXB import/upload/photo workflow
- `tests/test_qxb_photo_pick.py`
- `tests/test_qxb_pipeline.py`
- `tests/test_qxb_price_estimate.py`

### Telegram integration
- `tests/test_telegram_access.py`
- `tests/test_telegram_coo_bot.py`

### WeCom integration
- `tests/test_wecom_access.py`
- `tests/test_wecom_callback.py`
- `tests/test_wecom_group_upload.py`

### WhatsApp/customer gateway
- `tests/test_whatsapp_analysis.py`
- `tests/test_whatsapp_browser_adapter.py`
- `tests/test_whatsapp_business_polling.py`
- `tests/test_whatsapp_business_safety.py`
- `tests/test_whatsapp_business_session.py`
- `tests/test_whatsapp_business_web_connector.py`
- `tests/test_whatsapp_connector_readonly.py`
- `tests/test_whatsapp_importer.py`
- `tests/test_whatsapp_live_adapter.py`
- `tests/test_whatsapp_live_readonly.py`
- `tests/test_whatsapp_safety.py`
- `tests/test_whatsapp_sales_intelligence_full_report.py`

### agent routing
- `tests/test_inbound_message_router.py`
- `tests/test_router.py`

### approval routing/notification/draft approval
- `tests/test_approval_notification.py`
- `tests/test_approval_router.py`
- `tests/test_ceo_draft_approval.py`

### email routing/outbound/webhook/proxy behavior
- `tests/test_email_outbound.py`
- `tests/test_email_proxy.js`
- `tests/test_email_signature.py`
- `tests/test_email_test_filter.py`
- `tests/test_email_webhook_handler.py`

### knowledge ingest/runtime behavior
- `tests/test_knowledge_ingest.py`

### language policy/router
- `tests/test_agent_language_integration.py`
- `tests/test_language_policy.py`
- `tests/test_language_router.py`

### memory tool/rules
- `tests/test_customer_memory_rules.py`
- `tests/test_memory_tool.py`

### risk/safety behavior
- `tests/test_risk_classifier.py`
- `tests/test_risk_engine.py`

### shared runtime config, heartbeat, healthcheck, or supervision
- `tests/test_constitution_runtime.py`
- `tests/test_runtime_config.py`
- `tests/test_runtime_healthcheck.py`
- `tests/test_runtime_heartbeat.py`
- `tests/test_runtime_multi_agent.py`

### unknown from repo scan
- `tests/test_audit.py`
- `tests/test_authority_matrix.py`
- `tests/test_backup_recovery.py`
- `tests/test_cli_routing.py`
- `tests/test_constitution_loader.py`
- `tests/test_conversation_learning_pipeline.py`
- `tests/test_conversation_parser.py`
- `tests/test_customer_gateway_integration.py`
- `tests/test_customer_profile_builder.py`
- `tests/test_dispatcher.py`
- `tests/test_draft_queue.py`
- `tests/test_enquiry_context.py`
- `tests/test_growth_autopilot.py`
- `tests/test_message_tool.py`
- `tests/test_reply_style_learner.py`
- `tests/test_sales_brain_draft.py`
- `tests/test_sales_intelligence_engine.py`
- `tests/test_sales_message_classifier.py`
- `tests/test_sales_performance_analyzer.py`
- `tests/test_task_tool.py`
- `tests/test_tool_registry.py`
- `tests/test_truth_guard.py`

## 6. Duplicate Or Overlapping Concepts

| Concept | Evidence | Status |
| --- | --- | --- |
| Opportunity vs GrowthOpportunity | APSales commercial Opportunity and APCGO pre-sales Growth Opportunity both exist as documented models. | present |
| APCGO vs APBD | APCGO product architecture and APBD code/docs both exist. | present |
| APSales Runtime vs APCOO Runtime | APSales has its own runtime package while APCOO has shared runtime/service. | present |
| Knowledge Graph vs Growth Database | Engine knowledge schema and APCGO growth database design both define persistent intelligence objects. | present |
| MemoryStore vs markdown memory | APSales Runtime MemoryStore and markdown/file-based Memory Tool both exist. | present |
| APCOO approval gate vs APSales approval routing | COO approval gate, generic approval router, and customer-gateway approval notification coexist. | present |
| Node analytics vs Python analytics reports | Node site analytics and Python analytics/reporting modules coexist. | present |

## 7. Missing Or Incomplete Areas

- APCGO has product docs but no `agents/apcgo/runtime.py` found.
- APSEO has product docs but no `agents/apseo/runtime.py` found.
- APCGO growth database is documented, but no `data/apcgo/` store was found.
- Two runtime foundations exist; repo scan does not prove a single unified runtime owner.
- Two memory access patterns exist; repo scan does not prove one unified memory source of truth.

## 8. Recommended Next Actions

- Create a CTO-reviewed ownership map for overlapping concepts before adding new architecture.
- Before implementing APCGO runtime, define how it reuses or separates from APBD runtime files.
- Keep APSEO as product/operating documents until a CTO-approved runtime owner is defined.
- Choose a storage owner for APCGO GrowthOpportunity before daily automation.
- Document runtime ownership boundaries between `runtime/` and `apsales_runtime/`.
- Document when to use `tools/memory_tool.py` vs `apsales_runtime/memory.py`.
- Use existing Release Manager discipline for any future production-impacting changes.

## Scanner Notes

- Status labels are file-evidence heuristics: `active`, `partial`, `legacy`, or `missing`.
- `unknown from repo scan` means no matching file was found by this script.
- The scanner intentionally ignores `node_modules`, virtualenvs, git internals, and bytecode caches.
