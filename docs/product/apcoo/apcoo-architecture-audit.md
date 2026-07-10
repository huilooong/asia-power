# APCOO Architecture Audit

## Scope

This audit identifies the existing APCOO definition across the current AsiaPower repository.

This is an architecture audit only.

No code was written.
No architecture was redesigned.
No APCOO proposal was created.
No Runtime was modified.
No APCORE redesign was performed.

## 1. Existing APCOO Documents

### Primary APCOO Documents

| Filename | Purpose | Current Status | Last Known Scope |
| --- | --- | --- | --- |
| `README-AI-OS.md` | Main AsiaPower AI OS reference. Defines APCOO-001 as the COO Agent, documents CLI, Telegram bot, Constitution Engine, COO Core, Memory Tool, Tool Engine, Runtime Service, production service, approval workflow, and multi-agent runtime. | Active reference | Whole AI OS with APCOO as operations coordinator and default internal agent. |
| `constitution/roles/apcoo.md` | Formal APCOO role definition. Defines employee ID, title, reporting line, mandate, responsibilities, approval behavior, and communication standard. | Active role constitution | APCOO-001 role and authority posture. |
| `profiles/coo.yaml` | Runtime/profile configuration for COO Agent. Defines department, capabilities, responsibilities, tools, authority, escalation rules, KPI, and memory scope. | Active profile | Agent profile used by routing/prompt/profile loading. |
| `runtime/runtime_config.yaml` | Runtime configuration. Sets `agent_id: apcoo`, language, default channel, heartbeat interval, auto-restart, and enabled Telegram agents. | Active config | APCOO runtime plus APSales Telegram supervision. |
| `deploy/apcoo.service` | Systemd unit template for APCOO Runtime Service. | Active deployment template | Long-running Linux APCOO runtime process. |
| `ops/launchd/ai.asiapower.apcoo-bot.plist` | macOS launchd agent for local APCOO Telegram bot. | Active local ops reference | Starts `integrations/telegram_coo_bot.py`, logs to `memory/apcoo-bot.log`. |
| `TOOLS.md` | Local operational notes for tools and bot management. Includes APCOO bot identity, launchd management, private chat restriction, and voice-note behavior. | Active workspace reference | Human/operator runbook for local APCOO bot operation. |

### Architecture And Audit Documents Referencing APCOO

| Filename | Purpose | Current Status | Last Known Scope |
| --- | --- | --- | --- |
| `docs/architecture/architecture-overview.md` | Repository architecture audit. Lists APCOO as active internal AI OS module. | Active audit | Static repo architecture overview. |
| `docs/architecture/executive_summary.md` | Executive architecture summary. Mentions APCOO/APSales/APInventory internal AI OS skeleton as a completed foundation. | Active audit summary | CTO-level current-state assessment. |
| `docs/cto/apsales/apsales-100-sales-intelligence.md` | APSales Sales Intelligence architecture. Defines COO/APCOO as policy, escalation, and cross-agent coordination role in future AI organization. | Active APSales design | Sales Intelligence layer, with APCOO as escalation/policy role. |
| `docs/cto/apsales-runtime-v1.md` | APSales Runtime v1 design. References multi-agent config switches including APCOO/APInventory collaboration. | Active runtime design | APSales runtime; APCOO appears as adjacent multi-agent participant. |
| `docs/cto/ops-002-baseline-audit.md` | Ops baseline audit. References APCOO bot launchd management and voice-note support through historical commit notes. | Active ops audit | Operational baseline and deployment/ops state. |

### Agent Documents Referencing APCOO As Manager Or Escalation Owner

| Filename | Purpose | Current Status | Last Known Scope |
| --- | --- | --- | --- |
| `constitution/roles/apsales.md` | APSales role constitution. States APSales reports to APCOO and must not bypass APCOO/CEO for high-risk commitments. | Active role constitution | APSales authority and reporting line. |
| `constitution/roles/apinventory.md` | APInventory role constitution. States APInventory reports to APCOO. | Active role constitution | Inventory/catalog agent reporting line. |
| `constitution/roles/apbd.md` | APBD role constitution. States APBD reports to APCOO. | Historical/legacy for APBD; APCGO later supersedes product direction | Business development/growth reporting line. |
| `profiles/apsales.yaml` | APSales profile. Defines `reports_to: apcoo`, manager, escalation to APCOO and CEO, and HIGH/CRITICAL approval routing. | Active profile | APSales operational profile. |
| `profiles/apinventory.yaml` | APInventory profile. Defines `reports_to: apcoo`, manager, and escalation rules. | Active profile | APInventory operational profile. |
| `profiles/sales.yaml` | Older/general sales profile. Mentions COO Agent as manager and escalation target. | Likely legacy profile | Earlier sales-agent profile. |
| `profiles/inventory.yaml` | Older/general inventory profile. Mentions COO Agent as manager. | Likely legacy profile | Earlier inventory-agent profile. |
| `profiles/whatsapp.yaml` | WhatsApp profile. Mentions COO Agent as escalation target for payment disputes. | Likely legacy/adjacent profile | WhatsApp workflow escalation. |

### Validation / Test Specifications

| Filename | Purpose | Current Status | Last Known Scope |
| --- | --- | --- | --- |
| `tests/test_apcoo_ops_briefing.py` | Tests APCOO CEO ops briefing detection, website-content exclusion, deterministic daily brief, memory behavior, ping, and health. | Active test spec | CEO ops briefing and dispatcher behavior. |
| `tests/test_telegram_coo_bot.py` | Tests APCOO Telegram bot reply guarantees, ping/health, OpenAI route, exception fallback, and update handling. | Active test spec | Telegram COO bot behavior. |
| `tests/test_deploy_apcoo_service.py` | Tests APCOO systemd service template and management scripts for restart, env handling, logging, and healthcheck. | Active test spec | APCOO deployment files. |
| `tests/test_runtime_multi_agent.py` | Tests multi-agent runtime config and enabled Telegram agents. | Active test spec | APCOO/APSales runtime supervision config. |
| `tests/test_runtime_config.py` | Tests runtime config defaults including `agent_id: apcoo`. | Active test spec | Runtime config loader. |
| `tests/test_runtime_heartbeat.py` | Tests APCOO runtime heartbeat writing. | Active test spec | Heartbeat memory log. |
| `tests/test_constitution_loader.py` | Tests APCOO role loading and role ID mapping. | Active test spec | Constitution loading. |
| `tests/test_approval_router.py` | Tests approval routing where HIGH routes to APCOO then CEO and CRITICAL requires APCOO review plus CEO approval. | Active test spec | Approval routing. |
| `tests/test_language_policy.py` / `tests/test_language_router.py` | Tests internal APCOO/CEO language behavior. | Active test spec | Language policy. |

## 2. Current Responsibilities

### Confirmed Responsibilities

These are explicitly assigned to APCOO in active role/profile/runtime documents:

- Protect CEO time and operating focus.
- Plan execution from CEO goals.
- Convert CEO goals into executable task plans.
- Manage and track tasks across agents.
- Coordinate multi-agent priorities and deployment.
- Review engineer and agent output before CEO approval.
- Generate daily operational reports.
- Deliver CEO internal ops briefings from runtime/task/draft/health data.
- Report progress clearly and on request.
- Challenge poor decisions with facts and alternatives.
- Record operating plans and business decisions.
- Escalate cross-department conflicts.
- Review KPIs and weekly execution.
- Request CEO approval for L3/L4 authority actions.
- Act as policy/escalation/cross-agent routing owner for HIGH/CRITICAL approvals.
- Coordinate inventory and sales when escalation requires it.
- Route messages among APCOO, APSales, APInventory, and APBD/APCGO-era growth work where configured.
- Operate via CLI and Telegram private chat.
- Use Memory Tool, Task Tool, Message Tool, Planner, Critic, Reporter, and Tool Registry.
- Produce `/ping`, `/health`, `/plan`, `/tasks`, `/report`, `/review`, `/remember`, `/recall`, `/decision`, `/log`, `/tools`, and `/tool` command outputs.
- Maintain or trigger approval records through the approval gate.
- Use Chinese as default internal language with CEO.

### Proposed Responsibilities

These appear as future-state or adjacent architecture references, not as fully implemented APCOO-specific systems:

- Serve as COO role in future APSales Sales Intelligence organization for policy, escalation, and cross-agent routing.
- Coordinate inventory and sales inside future sales intelligence decisions.
- Participate in multi-agent collaboration switches in APSales Runtime config.
- Receive HIGH/CRITICAL approvals from APSales workflows.
- Be part of future organization with CEO Dashboard, Sales Director, Purchasing, Supplier Manager, Logistics, and Customer Success.

### Deprecated Responsibilities

No APCOO responsibility is explicitly marked deprecated in the audited files.

The following are explicitly listed as current limitations or not supported, not deprecated responsibilities:

- WhatsApp COO channel.
- Group chat or multi-user RBAC for COO Telegram.
- Webhook/HTTPS server for COO Telegram.
- Auto deployment or systemd install from Telegram MVP.
- Inventory Tool execution in early Telegram MVP.
- Auto-running tasks from COO commands.
- Live deploy, git push, WhatsApp/Telegram send through Tool Engine.

## 3. Current Workflows

### Workflow 1: CLI COO Command

```text
Input
CEO runs `python main.py "/plan ..."` or another COO slash command.

↓

Processing
`main.py` / `coo_core.cli_router.dispatch_cli_message`
  -> `coo_core.dispatcher.dispatch_message`
  -> `dispatch_coo_command`
  -> Planner / Task Tool / Reporter / Critic / Memory Tool / Tool Registry.

↓

Output
Plan, task summary, daily report, review verdict, memory record, decision record, health response, or tool output.

↓

Next Owner
CEO, APCOO, or assigned owner agent in `data/tasks.json`.
```

### Workflow 2: Telegram COO Private Chat

```text
Input
CEO sends message to APCOO Telegram bot in private chat.

↓

Processing
`integrations/telegram_coo_bot.py`
  -> long polling `getUpdates`
  -> `integrations.telegram_coo_handler.handle_telegram_update`
  -> `authorize_chat` private + whitelist check
  -> optional voice transcription
  -> `dispatch_telegram_message`
  -> `coo_core.dispatcher.dispatch_message`.

↓

Output
Telegram reply, fallback reply, logged inbound/outbound message.

↓

Next Owner
CEO for review/action, or APCOO dispatcher for routed agent handling.
```

### Workflow 3: Normal Routed Agent Chat

```text
Input
CEO sends non-slash text to APCOO through CLI or Telegram.

↓

Processing
`coo_core.dispatcher.dispatch_message`
  -> `agents.router.route_with_profile`
  -> load agent profile
  -> load Constitution + role
  -> language router
  -> optional deterministic CEO ops briefing / verified sales intelligence / knowledge runtime
  -> OpenAI response when required
  -> memory tags only if explicitly requested
  -> log conversation.

↓

Output
Internal CEO-facing answer in Chinese by default, or routed response from selected agent profile.

↓

Next Owner
CEO, APCOO, APSales, APInventory, or other routed agent depending on content.
```

### Workflow 4: CEO Ops Briefing

```text
Input
CEO asks for current status, operations status, project progress, risk, blockers, or today's summary.

↓

Processing
`coo_core.ceo_ops_briefing.detect_ceo_ops_query`
  -> collect tasks, decisions, drafts, WhatsApp status, health, daily log
  -> render fixed CEO Daily Brief sections.

↓

Output
Deterministic CEO Daily Brief with sections:
今日结论, 已完成, 当前运行状态, 数据资产, 风险, 下一步.

↓

Next Owner
CEO or relevant task owner.
```

### Workflow 5: Website / SEO Content Query Exclusion

```text
Input
CEO asks about public website content, copy, SEO, landing page, or page wording.

↓

Processing
`detect_website_content_query`
  -> prevent internal ops briefing mode
  -> add website/content prompt addon
  -> route to normal content advice flow.

↓

Output
Public website/content/SEO advice, not internal task queue or system-health briefing.

↓

Next Owner
CEO, SEO/product/content operator.
```

### Workflow 6: Approval Gate

```text
Input
CEO message or LLM reply contains high-risk or catastrophic action intent.

↓

Processing
`coo_core.approval_gate`
  -> detect catastrophic intent or parse `APPROVAL_REQUEST`
  -> create pending approval JSON under `memory/approvals/pending`
  -> log approval required in audit
  -> format CEO approval request
  -> resolve oldest pending approval when CEO replies approved/rejected/revise.

↓

Output
Approval card, approval resolution, audit log entry, pending/resolved approval file.

↓

Next Owner
CEO. APCOO does not execute L4 human-only actions.
```

### Workflow 7: Daily COO Report

```text
Input
CEO runs `/report`.

↓

Processing
`coo_core.reporter.generate_daily_report`
  -> summarize tasks
  -> summarize recent decisions
  -> compute next recommended action
  -> write `reports/daily_report_YYYY-MM-DD.md`.

↓

Output
COO Daily Report markdown and response text.

↓

Next Owner
CEO / assigned task owners.
```

### Workflow 8: Runtime Service

```text
Input
`python -m runtime.service` or systemd `apcoo.service`.

↓

Processing
`runtime.service`
  -> load `.env`
  -> load runtime config
  -> bootstrap constitution, identity, memory, tools
  -> healthcheck
  -> heartbeat thread
  -> Telegram supervisor thread unless disabled
  -> audit agent_start / agent_stop.

↓

Output
Long-running APCOO runtime, heartbeat logs, supervised Telegram bots, audit logs.

↓

Next Owner
Runtime operator / CEO.
```

### Workflow 9: Telegram Bot Supervisor

```text
Input
Runtime starts Telegram supervisor.

↓

Processing
`runtime.supervisor.supervised_telegram_loop`
  -> read enabled agents from config
  -> register APCOO and APSales bot runners
  -> start independent daemon threads
  -> auto-restart crashed bots if enabled
  -> log restarts to daily memory.

↓

Output
APCOO and APSales Telegram bots supervised independently.

↓

Next Owner
Runtime operator.
```

### Workflow 10: APSales High-Risk Escalation

```text
Input
APSales request involves final quote, payment terms, delivery, refund, external message, or HIGH/CRITICAL risk.

↓

Processing
APSales profile/role and approval router classify escalation:
  MEDIUM -> CEO Telegram directly
  HIGH -> APCOO review then CEO recommendation
  CRITICAL -> APCOO review -> CEO approval -> execution only.

↓

Output
Escalation route, approval request, or blocked execution.

↓

Next Owner
APCOO and CEO for high/critical approval path; APSales after approved action.
```

### Workflow 11: APInventory Reporting Line

```text
Input
APInventory has listing, catalog, VIN, QXB, supplier, or stock verification issue requiring escalation.

↓

Processing
APInventory profile/role defines reporting to APCOO and escalation for human catalog admin, supplier portal team, or operations.

↓

Output
Issue routed upward; no direct APCOO implementation workflow beyond reporting/escalation is defined.

↓

Next Owner
APCOO / human operations / APInventory depending on issue.
```

## 4. Current Integrations

### APCORE

No explicit `APCORE` architecture or module was found in the repository search.

Existing APCOO integrations that appear to serve core-platform functions:

- Constitution loader: `coo_core/constitution_loader.py`.
- Constitution runtime: `core/constitution_runtime.py`.
- Language router: `core/language_router.py`.
- Agent registry: `agents/agent_registry.py`.
- Router/profile loading: `agents/router.py`, `agents/profile_loader.py`.
- Audit logger: `audit/logger.py`.
- Safety/approval/recovery modules under `safety/` and `coo_core/approval_gate.py`.

Audit conclusion:

APCOO is integrated with core constitution, language, routing, audit, safety, memory, and tool layers, but no separately named APCORE system is currently defined.

### APSales

Existing integration points:

- APSales reports to APCOO in `constitution/roles/apsales.md` and `profiles/apsales.yaml`.
- APCOO dispatcher can route directly to APSales via `dispatch_message(..., agent_id="apsales")`.
- CLI router resolves APSales commands and natural slash commands.
- APCOO healthcheck checks `sales_core.apsales_handler`.
- Runtime supervisor can run both APCOO and APSales Telegram bots.
- APSales Sales Intelligence defines APCOO as policy/escalation/cross-agent routing owner.
- APSales escalation rules route HIGH to APCOO then CEO, CRITICAL to APCOO review then CEO approval.

### APCGO

Existing direct APCOO/APCGO integration is not defined in current APCGO product documents.

Related historical/legacy integration:

- `constitution/roles/apbd.md` states APBD reports to APCOO.
- `coo_core/cli_router.py` routes `/apbd` commands to APBD runtime.
- APCGO was later defined under `docs/product/apcgo/` as a product architecture, but those documents do not define APCOO runtime ownership or APCOO command integration.

Audit conclusion:

APCGO currently has product documents but no confirmed APCOO runtime integration.

### APSEO

No direct APCOO/APSEO integration was found.

APSEO documents are product strategy documents under `docs/product/seo/`. They do not currently define APCOO ownership, runtime workflow, or approval path.

### Runtime

Existing APCOO runtime integrations:

- `runtime/service.py`: APCOO Runtime Service.
- `runtime/runtime_config.yaml`: `agent_id: apcoo`.
- `runtime/config_loader.py`: defaults to APCOO.
- `runtime/heartbeat.py`: writes APCOO runtime heartbeat.
- `runtime/healthcheck.py`: verifies APCOO dependencies.
- `runtime/supervisor.py`: supervises APCOO and APSales Telegram bots.
- `deploy/apcoo.service`: systemd unit for APCOO runtime.
- `ops/launchd/ai.asiapower.apcoo-bot.plist`: local launchd APCOO bot runner.

### Knowledge Graph

Existing APCOO integrations:

- `coo_core.dispatcher` optionally attempts to import `knowledge.guard` and `knowledge.runtime`.
- If available, it bootstraps knowledge runtime and injects read-only facts into routed replies.
- `coo_core.health_check` checks `knowledge.runtime.bootstrap_knowledge_runtime`.

Current status:

The dispatcher treats Knowledge Runtime as optional. If import fails, it skips augmentation.

### Supplier

Existing APCOO supplier integration is indirect through APInventory and Memory:

- APInventory reports to APCOO.
- APInventory owns supplier-facing WeCom and catalog/QXB workflows.
- APCOO profile can create and assign tasks to Sales, Inventory, and WhatsApp agents.
- Runtime/memory includes supplier scope through tools and related profiles.

No direct supplier-facing APCOO workflow was found.

### Dashboard

Existing APCOO dashboard integration is partial:

- APCOO can generate textual daily reports under `reports/daily_report_YYYY-MM-DD.md`.
- APCOO CEO ops briefing collects tasks, decisions, drafts, WhatsApp status, health, and daily logs.
- APSales Sales Intelligence future-state defines CEO Dashboard and COO interaction.

No dedicated APCOO dashboard UI was found.

## 5. Existing Boundaries

### What APCOO Owns

APCOO currently owns:

- Internal operations coordination.
- CEO-facing planning.
- Task creation and tracking.
- Daily operational reporting.
- Engineer/agent output review through Critic.
- Approval request creation and resolution tracking.
- High/critical escalation coordination.
- CLI and Telegram command dispatch for COO commands.
- Routing to other agents through the shared dispatcher.
- Constitution-aware internal agent context.
- Runtime heartbeat and healthcheck surface for APCOO runtime.
- Operational briefings based on read-only task, decision, draft, health, WhatsApp, and log data.

### What APCOO Must NOT Own

APCOO must not own:

- Customer conversation execution.
- Customer-facing APSales drafts or final customer messaging.
- Final price, delivery, refund, or payment commitments.
- Supplier-facing WeCom operations.
- Inventory verification, listing approval, catalog publication, or QXB live upload.
- Public SEO/content execution as APSEO.
- Growth opportunity generation as APCGO.
- Automatic publishing.
- Automatic outreach.
- Payment or bank operations.
- API key/secret operations.
- Delete data or delete memory execution.
- Production deployment execution without CEO approval and release discipline.
- Direct memory file writes outside Memory Tool.
- Direct script execution outside Tool Registry where the Tool Engine applies.
- Database, FastAPI, Docker, Redis, Celery, or external API expansion without approval, per current AI OS rules.

## 6. Existing Runtime Components

### Agents

| Agent | Current Association With APCOO |
| --- | --- |
| APCOO | Primary runtime agent, default internal agent, COO role. |
| APSales | Reports to APCOO; supervised alongside APCOO in runtime config. |
| APInventory | Reports to APCOO; routed by dispatcher/CLI router. |
| APBD | Legacy growth/business development agent; reports to APCOO in role file and `/apbd` command route exists. |

### Queues

Existing APCOO-associated queues:

- `data/tasks.json` through Task Tool.
- `memory/approvals/pending/*.json` and `memory/approvals/resolved/*.json` through approval gate.
- APSales/customer draft queues are read by CEO ops briefing but owned by Customer Gateway/APSales, not APCOO.

No APCOO-specific task queue service equivalent to APSales Runtime Task Queue was found.

### Memory

Existing APCOO-associated memory:

- `memory/company/`
- `memory/decisions/`
- `memory/projects/`
- `memory/customers/`
- `memory/suppliers/`
- `memory/daily_logs/`
- `memory/agent_notes/`
- `memory/index.json`
- `memory/shared_memory.md`
- `memory/decisions.md`
- `memory/customers.md`
- `memory/daily_logs/runtime-heartbeat.md`
- `memory/approvals/pending/`
- `memory/approvals/resolved/`

Access rule:

All memory I/O should go through `tools/memory_tool.py`.

### Scheduler

Existing APCOO-associated scheduling/supervision:

- Runtime heartbeat loop in `runtime/heartbeat.py`.
- Telegram supervisor auto-restart in `runtime/supervisor.py`.
- systemd `Restart=always` in `deploy/apcoo.service`.
- macOS launchd `RunAtLoad` / `KeepAlive` via `ops/launchd/ai.asiapower.apcoo-bot.plist`.

No APCOO business-task scheduler was found beyond heartbeat/supervision.

### Event Handlers

Existing APCOO-associated event handling:

- Telegram long polling update handling in `integrations/telegram_coo_bot.py`.
- Telegram message handling in `integrations/telegram_coo_handler.py`.
- Approval resolution through `coo_core.approval_gate.resolve_reply`.
- Runtime start/stop audit events in `runtime/service.py`.
- Approval required/granted audit events in `coo_core.approval_gate`.

No APCOO Event Bus equivalent to APSales Runtime Event Bus was found.

### Reports

Existing APCOO-associated reports:

- `reports/daily_report_YYYY-MM-DD.md` generated by `coo_core/reporter.py`.
- CEO Daily Brief generated in memory/response by `coo_core/ceo_ops_briefing.py`.
- Health response generated by `coo_core/health_check.py`.
- Runtime heartbeat markdown under `memory/daily_logs/runtime-heartbeat.md`.

### Dashboards

Existing APCOO-associated dashboard:

```text
No dedicated APCOO dashboard UI found.
```

Existing related surfaces:

- CLI command outputs.
- Telegram replies.
- Daily report markdown.
- CEO ops briefing.
- APSales future CEO Dashboard design references.

## 7. Missing Pieces

Only genuine gaps found in existing APCOO definition are listed here.

1. No dedicated APCOO product architecture document exists under `docs/product/apcoo/` before this audit.
2. No explicit APCORE module exists; APCOO uses core constitution/language/routing/audit modules, but APCORE is not named or defined.
3. No APCOO-specific Event Bus exists.
4. No APCOO-specific business task queue service exists beyond `data/tasks.json`.
5. No dedicated APCOO dashboard UI exists.
6. No direct APCGO-to-APCOO integration is defined after APBD was superseded by APCGO product architecture.
7. No direct APSEO-to-APCOO integration is defined.
8. No direct supplier-facing APCOO workflow is defined; supplier operations are assigned to APInventory.
9. No centralized cross-agent approval ledger is defined beyond approval files and audit logs.
10. No semantic memory or embedding search is implemented; memory recall is keyword-based per current limitations.
11. No concurrency locking is defined for the single JSON task store.

## 8. CTO Recommendation

Recommendation:

```text
Extend Existing
```

Reason:

APCOO already exists as an active internal AI OS component with role constitution, profile, CLI command layer, Telegram bot, dispatcher, planner, critic, reporter, approval gate, healthcheck, heartbeat, runtime service, launchd/systemd service definitions, and tests.

Building a new APCOO would duplicate working foundations.

Reusing without extension would ignore real gaps already visible in the audit, especially missing APCOO product documentation, missing APCGO/APSEO integration definitions, no dedicated dashboard, no APCOO event bus, and no robust task-store concurrency model.

Therefore the correct CTO direction is to extend the existing APCOO foundation only after CTO review, without redesigning APCOO or creating a parallel COO system.

Status:

```text
READY FOR CTO REVIEW
```
