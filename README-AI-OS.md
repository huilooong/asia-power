# AsiaPower AI OS (v1.0 + APAG-001 APSales)

Multi-agent operating system for AsiaPower auto parts export operations.

The **COO Agent (APCOO-001)** coordinates operations. **APSales (APSALES-001)** is the platform GMV growth agent for buyer–supplier matchmaking, CRM, and pipeline — not a traditional salesperson.

## How to Run

```bash
cd /Users/longhui/Desktop/AsiaPower
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-ai-os.txt
```

Add to `.env`:

```bash
OPENAI_API_KEY=sk-...
```

Start the interactive CLI:

```bash
python main.py
```

One-shot message (chat mode):

```bash
python main.py "客户问G4KD发动机多少钱，帮我回复。"
```

COO commands (no API key required):

```bash
python main.py "/plan Build VIN Tool"
python main.py "/tasks"
python main.py "/report"
python main.py "/review Cursor added FastAPI and wrote memory directly"
```

Run unit tests (no API key, no Telegram network):

```bash
python -m unittest discover -s tests -v
```

## Telegram COO Bot (MVP)

Independent bot for CEO ↔ COO chat. **Does not** use `ASIAPOWER_TELEGRAM_BOT_TOKEN`.

### Environment variables

```bash
COO_TELEGRAM_BOT_TOKEN=123456:ABC...        # from @BotFather (dedicated COO bot)
COO_TELEGRAM_ALLOWED_CHAT_IDS=123456789      # comma-separated private chat_id whitelist
OPENAI_API_KEY=sk-...                       # required for normal chat (not for /plan etc.)
```

### Get your chat_id

1. Create a bot via [@BotFather](https://t.me/BotFather) → copy token to `COO_TELEGRAM_BOT_TOKEN`
2. Start a **private** chat with the bot → send `/start`
3. Read `chat_id` from bot logs, or call `getUpdates` while polling once
4. Add that id to `COO_TELEGRAM_ALLOWED_CHAT_IDS`

### Run locally

```bash
python integrations/telegram_coo_bot.py
```

Long polling only — **no webhook**, no Docker, no auto-deploy.

### Security (MVP)

- **Private chats only** — group/supergroup messages are ignored and logged as rejected
- **Whitelist only** — unauthorized `chat_id` is rejected **without calling COO Core**
- Rejected/ignored events logged to `data/message_log.jsonl` (summary only, max ~500 chars)
- COO bot token is separate from site notification bot

### Allowed commands (same as CLI)

| Command | Description |
|---------|-------------|
| `/start` | Show help |
| `/help` | Show help |
| `/plan <goal>` | Create plan + tasks |
| `/tasks` | Task summary |
| `/report` | Daily COO report |
| `/review <text>` | Critic review |
| *(any text)* | Routed agent chat (needs `OPENAI_API_KEY`) |

### What this version cannot do

- WhatsApp COO channel
- Group chat or multi-user RBAC
- Webhook / HTTPS server
- Auto deployment or systemd install
- Inventory Tool execution
- Reply to unauthorized users (silent reject + audit log only)

### Shared dispatcher

Both CLI and Telegram call **`coo_core.dispatcher.dispatch_message(text, source=..., user_id=...)`** — single entry point, no duplicate command logic in `main.py`.

---

## Constitution Engine

The Constitution Engine ensures every AI employee loads AsiaPower's mission, values, authority rules, communication standards, and founder intent **before** acting.

### Purpose

- Constitution ranks **above** prompts, models, tools, and agent profiles.
- Normal chat (CLI + Telegram) injects constitution context into the system prompt via `coo_core/constitution_loader.py`.
- COO slash commands (`/plan`, `/tasks`, etc.) do not call OpenAI and do not need constitution injection.

### File structure

```
constitution/
  VERSION                      # e.g. v1.0
  00_company_constitution.md
  01_mission.md
  02_vision.md
  03_core_values.md
  04_decision_principles.md
  05_authority_matrix.md
  06_communication_standard.md
  07_company_culture.md
  99_founders_intent.md
  roles/
    apcoo.md                   # APCOO-001 COO role
```

### Versioning

- Bump `constitution/VERSION` when making material changes (e.g. `v1.0` → `v1.1`).
- `load_constitution_version()` reads this file; missing VERSION fails loudly.

### How it affects APCOO

- Routed COO chat loads full constitution + `roles/apcoo.md`.
- Telegram replies default to **Chinese** with CEO (conclusion → reason → recommendation).
- No programmer-style headers (`[Agent | model]`) in CEO-facing replies.

### How to update constitution

1. Edit the relevant markdown under `constitution/` or `constitution/roles/`.
2. Bump `constitution/VERSION` if the change is material.
3. Run tests: `python -m unittest discover -s tests -v`
4. Restart Telegram bot if running: `python integrations/telegram_coo_bot.py`

### Loader API

| Function | Description |
|----------|-------------|
| `load_constitution_version()` | Read `VERSION` |
| `load_constitution()` | All company constitution sections |
| `load_role(role_id)` | Single role file (e.g. `apcoo`) |
| `build_constitution_context(role_id="apcoo")` | Constitution + role for system prompt |

Missing required files raise `ConstitutionError` with the expected path — nothing is silently skipped.

---

## Current Architecture

```
main.py                      # CLI → dispatch_message()
integrations/
  telegram_coo_bot.py        # Telegram long polling → dispatch_message()
  telegram_access.py         # private + whitelist checks
coo_core/
  dispatcher.py              # SINGLE entry: COO commands + Router + OpenAI
  constitution_loader.py     # Constitution + role context for agents
  planner.py / critic.py / reporter.py
tools/
  memory_tool.py
  task_tool.py
  message_tool.py            # Telegram send + message_log.jsonl audit
data/
  tasks.json
  message_log.jsonl
```

**Chat flow:**

1. User message → `agents/router.py` picks agent.
2. `constitution_loader` builds constitution (+ role for COO).
3. OpenAI Responses API + profile prompt + constitution context.
4. Memory tags parsed → `tools/memory_tool.py` only.

**COO flow:**

1. `/plan` → `coo_core/planner.py` → `tools/task_tool.py`
2. `/tasks` → task summary
3. `/report` → `coo_core/reporter.py` → `reports/`
4. `/review` → `coo_core/critic.py` → verdict

## COO Core

| Module | Role |
|--------|------|
| **Planner** | Converts CEO goals into phases, tasks, risks, required tools |
| **Task Engine** | `tools/task_tool.py` — persistent tasks in `data/tasks.json` |
| **Critic** | Rule-based review of engineer/Cursor output before CEO approval |
| **Reporter** | Daily summary: pending/completed/blocked tasks + recent decisions |

### COO Commands

| Command | Description |
|---------|-------------|
| `/plan <goal>` | Create execution plan and materialize tasks |
| `/tasks` | Show task summary (pending, urgent, counts) |
| `/report` | Generate `reports/daily_report_YYYY-MM-DD.md` |
| `/review <text>` | Run Critic on supplied engineer output |

### Planner templates

Rule-based (no OpenAI inside planner):

- **VIN Tool** — API research, design, build, test, docs
- **Inventory Tool** — schema, CRUD, tests, docs
- **WhatsApp** — API choice, intake, reply workflow, approval rules
- **Default** — research, design, build, test, review

### Task Tool API

| Function | Description |
|----------|-------------|
| `create_task(...)` | Create task with priority, owner, tags |
| `list_tasks(status, owner_agent)` | Filter tasks |
| `get_task(task_id)` | Single task |
| `update_task(task_id, **updates)` | Update fields |
| `complete_task(task_id)` | Mark completed |
| `cancel_task(task_id)` | Mark cancelled |
| `search_tasks(keyword)` | Search title/description/tags |
| `summarize_tasks()` | Counts and highlights |

Task fields: `id`, `title`, `description`, `owner_agent`, `created_by`, `priority`, `status`, `due_date`, `dependencies`, `tags`, `created_at`, `updated_at`, `completed_at`.

### Critic verdicts

- `approved` — follows architecture, has tests, small scope
- `changes_required` — fix issues before merge
- `rejected` — critical violations (direct memory writes, hard-coded secrets)

### Agent Profile (COO)

`profiles/coo.yaml` includes:

- **capabilities:** planning, task_management, review, reporting
- **tools:** Memory Tool, Task Tool, Message Tool, Planner, Critic, Reporter

## Memory Tool (Persistent Memory Engine)

All memory I/O goes through `tools/memory_tool.py`. Agents must not write memory files directly.

### Directory structure

```
memory/
├── company/           # Company-level notes
├── decisions/         # One file per decision (CEO approval tagged)
├── projects/          # One file per project slug
├── customers/         # One file per customer
├── suppliers/         # One file per supplier
├── daily_logs/        # YYYY-MM-DD.md conversation logs
├── agent_notes/       # General agent observations
├── index.json         # Searchable index of all entries
├── shared_memory.md   # Legacy (still read + mirrored writes)
├── decisions.md       # Legacy
└── customers.md       # Legacy
```

### Core capabilities

1. **Daily logs** — important conversations auto-logged to `daily_logs/` after chat
2. **Decisions** — structured files in `decisions/` with `CEO Approval: approved|pending|not_required`
3. **Projects** — `/remember project:slug | update` creates `projects/{slug}.md`
4. **Context loading** — `load_context_for_message()` injects relevant memory before OpenAI calls
5. **CEO commands** — `/remember`, `/recall`, `/decision`, `/log` (no API key required)

### Memory commands

| Command | Example |
|---------|---------|
| `/remember [category] \| note` | `/remember plan \| Deploy VIN tool phase 1` |
| `/recall <keyword>` | `/recall G4KD` |
| `/decision title \| reason \| decision [\| approved]` | `/decision Deploy \| Ready \| Friday push \| pending` |
| `/log` | Show today's daily log |
| `/log summary` | Append manual log entry |

**Important decisions** (deploy, production, payment, delete, etc.) **must** include CEO approval status (`approved`, `pending`, or `not_required`). Otherwise the command is rejected.

### Loader API

| Function | Description |
|----------|-------------|
| `remember(content, category=..., project=...)` | Save to structured folder + index |
| `recall(keyword)` | Search and format hits |
| `record_decision(title, reason, decision, ceo_approval=...)` | Structured decision file |
| `log_daily(summary, ...)` | Append daily log |
| `log_conversation(inbound, outbound, ...)` | Auto-log after chat |
| `load_context_for_message(message)` | Keyword-based context for agents |
| `search_memory(keyword)` | Raw search hits |

## Tool Engine (Action Engine)

All agent tool execution goes through `tools/registry.py`. Agents must not call scripts directly.

### Registered tools

| Tool | Permission | Actions |
|------|------------|---------|
| `vin` | read_only | Local VIN cache lookup |
| `inventory` | read_only | `search`, `preview_update` (dry-run) |
| `git` | read_only | `status`, `branch`, `log` |
| `deploy` | deploy | `dry-run`, `run` (live blocked in v0.6) |
| `whatsapp` | external_message | `preview`, `send` (gated) |
| `telegram` | external_message | `status`, `preview`, `send` (gated) |

### Permission levels

- `read_only` — APCOO may run freely
- `write` — staging / preview only by default
- `deploy` — dry-run default; live needs CEO approval
- `payment` — human only
- `external_message` — preview free; send needs CEO approval

### CEO approval gate

Live execution of deploy, delete, constitution changes, formal outbound messages, and payment/quote commitments requires `| approved` on the command.

### Commands

```bash
/tools
/tool git status
/tool deploy dry-run
/tool vin LFMAY86C3K0406545
/tool inventory search G4KD
```

Tool calls are logged to `memory/daily_logs/`; high-risk actions also create entries in `memory/decisions/`.

## Runtime Service (24h Agent Runner)

Long-running APCOO service with healthcheck, heartbeat, and Telegram supervisor.

### Commands

```bash
python -m runtime.service              # Full runtime (Telegram + heartbeat)
python -m runtime.service --once --no-telegram   # Bootstrap test, no network
python -m runtime.healthcheck          # Dependency check → Overall: OK
python -m runtime.heartbeat --once     # Write one heartbeat entry
```

### Startup flow

1. Load Constitution + role (`apcoo`)
2. Load Identity (`IDENTITY.md`)
3. Load Memory (`memory/index.json`)
4. Load Tool registry
5. Run healthcheck (critical checks must pass)
6. Start heartbeat thread → `memory/daily_logs/runtime-heartbeat.md`
7. Start Telegram supervisor (auto-restart on crash)

### Config (`runtime/runtime_config.yaml`)

| Key | Default |
|-----|---------|
| `agent_id` | `apcoo` |
| `language` | `zh` |
| `default_channel` | `telegram` |
| `heartbeat_interval_seconds` | `300` |
| `auto_restart` | `true` |

`main.py` and `integrations/telegram_coo_bot.py` remain unchanged for interactive/standalone use.

## Production Deployment (systemd)

Deploy APCOO as a long-running Linux systemd daemon. **Secrets stay in `.env` only** — never in the unit file.

### Files

```
deploy/
├── apcoo.service          # systemd unit template (@@APCOO_ROOT@@ placeholders)
├── install_service.sh     # healthcheck → install → enable → start
├── uninstall_service.sh
├── restart_service.sh
├── status_service.sh
└── tail_logs.sh
```

### Prerequisites (production server)

1. Clone/sync project to server (e.g. `/root/.openclaw/workspace/AsiaPower`)
2. Create venv and install deps: `pip install -r requirements-ai-os.txt`
3. Configure `.env` (`OPENAI_API_KEY`, `COO_TELEGRAM_BOT_TOKEN`, `COO_TELEGRAM_ALLOWED_CHAT_IDS`, …)
4. Verify: `python -m runtime.healthcheck` → **Overall: OK**

### Install

```bash
sudo bash deploy/install_service.sh
```

Install **aborts** if healthcheck fails.

### Manage

```bash
bash deploy/status_service.sh      # systemctl status apcoo
bash deploy/tail_logs.sh           # journalctl -u apcoo (last 100 lines)
bash deploy/tail_logs.sh -f        # follow logs
sudo bash deploy/restart_service.sh
sudo bash deploy/uninstall_service.sh
```

### Service behaviour

| Setting | Value |
|---------|-------|
| `ExecStart` | `python -m runtime.service` |
| `WorkingDirectory` | project root (set at install) |
| `Restart` | `always` / `RestartSec=10` |
| `EnvironmentFile` | `<project>/.env` |
| Logs | `journalctl -u apcoo` |

On macOS/local dev, `status_service.sh` and `tail_logs.sh` fall back to helpful messages and local log paths.

## APAG-001 — APSales Platform GMV Agent

First **production business agent** — drives **platform GMV growth**, not traditional self-operated sales.

APSales helps buyers find valuable machines faster and helps suppliers convert inventory through AsiaPower's verified supplier network. **AsiaPower does not assume it owns inventory** unless the inventory tool confirms a catalog match.

```
CEO → APCOO → APSales → Customer (draft only, after approval)
```

### Platform positioning

- **Not** a procurement company or traditional exporter holding stock
- **Not** selling only AsiaPower-owned products
- Default customer wording: *"We can check available supply from our verified China-based supplier network."*
- Only mention confirmed availability when **inventory tool** returns a match

### CLI

```bash
python main.py "/sales customer: Do you have G4KJ engine?"
```

Internal analysis (Chinese) must include: 买方需求、潜在供应商匹配、库存归属状态、平台机会、缺失信息、审批要求

### Role & files

| Item | Path |
|------|------|
| Constitution role | `constitution/roles/apsales.md` |
| Profile | `profiles/apsales.yaml` |
| Handler | `sales_core/apsales_handler.py` |
| CRM | `tools/crm_tool.py` |
| Approval | `agents/approval_router.py` |
| Language | `core/language_router.py` + `config/language_policy.yaml` |
| Pipeline | `memory/projects/sales_pipeline.md` |
| Customers | `memory/customers/` |

### Dispatcher

```python
dispatch_message(text, source="cli", user_id=None, agent_id="apcoo")  # default
dispatch_message(text, source="cli", agent_id="apsales")
```

Supported: `apcoo`, `apsales` (future: `apinventory`, `apmarketing`, …)

### Unified Language Policy (APAI-011)

All agents use **`core/language_router.py`** — the sole language decision layer. Policy is loaded from **`config/language_policy.yaml`** at runtime bootstrap.

| Scenario | Participants | Default | Auto-detect |
|----------|--------------|---------|-------------|
| **Internal** | CEO, APCOO, all AI agents, audit, memory, approval | Chinese (`zh`) — mandatory | — |
| **Buyer** | APSales → export buyers | English (`en`) | French, Arabic (+ extensible list in YAML) |
| **Supplier** | APSupply → suppliers | Chinese (`zh`) | English (+ extensible) |

API:

```python
from core.language_router import detect_language, resolve_target_language

resolve_target_language("apsales", "buyer", message)   # → en | fr | ar
resolve_target_language("apsupply", "supplier", msg) # → zh | en
resolve_target_language("apcoo", "ceo", message)      # → zh
```

Buyer-facing drafts must sound natural — never expose AI, approval workflow, or internal structure.

CRM records store **Detected Language**, **Communication Language**, and **Preferred Language** (`tools/crm_tool.py`).

Every APSales enquiry returns two sections:

- **【内部分析】** — Chinese: demand, risk, gaps, recommendation
- **【客户草稿】** — Buyer language: ready-to-send draft (approval required before send)

**Future expansion:** add language codes to `buyer.supported` or `supplier.supported` in YAML without per-agent changes.

### Customer Gateway — WhatsApp Sales Intelligence (APAG-001B)

**Read Only. Analyze First. Learn First. Improve First. No Auto Reply.**

从历史中学习，但不要盲目模仿 CEO。详见 `customer_gateway/README.md`。

| Module | Path |
|--------|------|
| Connector (read-only) | `customer_gateway/whatsapp_connector.py` |
| Sync | `customer_gateway/whatsapp_readonly_sync.py` |
| Performance analyzer | `customer_gateway/sales_performance_analyzer.py` |
| Intelligence report | `customer_gateway/whatsapp_intelligence_report.py` |
| Profiles | `customer_gateway/customer_profile_builder.py` |

Data: `memory/customer_gateway/` + `reports/` + `sync_state.json`

```bash
python main.py "/whatsapp import path/to/chat.txt"
python main.py "/whatsapp sync --readonly"
python main.py "/whatsapp analyze"
python main.py "/whatsapp report"
python main.py "/customer followups"
python main.py "/customer search G4KJ"
```

`/whatsapp analyze` 输出《WhatsApp 销售智能报告》：总体分析、产品排行、销售漏斗、跟进清单、CEO 回复效果分析、APSales 改进 SOP。

### Approval workflow

| Level | Route |
|-------|-------|
| LOW | Agent records internally |
| MEDIUM | CEO Telegram directly |
| HIGH | APCOO review → CEO recommendation |
| CRITICAL | APCOO review → CEO approval → execution |

Blocked without approval: final quote, payment terms, delivery, refunds, external messages.

### APSales Telegram (internal console)

**Not** a customer chatbot — CEO work console only. WhatsApp 销售智能命令输出为**中文**。

```bash
# .env
APSALES_TELEGRAM_BOT_TOKEN=
APSALES_TELEGRAM_ALLOWED_CHAT_IDS=

# 可选：服务器上 WhatsApp 导出 .txt 目录（只读同步源）
WHATSAPP_READONLY_EXPORT_DIR=/path/to/whatsapp/exports

python integrations/telegram_apsales_bot.py
```

#### WhatsApp 销售智能（Telegram 命令）

在 APSales Telegram 私聊中发送（全部只读，不发送 WhatsApp）：

| 命令 | 说明 |
|------|------|
| `/whatsapp sync --readonly` | 从 `WHATSAPP_READONLY_EXPORT_DIR` 或已解析数据只读同步 |
| `/whatsapp analyze` | 生成《WhatsApp 销售智能报告》（中文） |
| `/whatsapp report` | 查看最新完整报告 |
| `/customer followups` | 客户跟进清单（今天/本周/重新激活/归档） |
| `/customer search <关键词>` | 搜索客户画像与历史消息 |

安全边界：禁止发送/修改 WhatsApp；禁止自动承诺价格、库存、交期。

#### 报告位置

完整 Markdown 报告持久化在：

`memory/customer_gateway/reports/latest_report.md`

（每次 `/whatsapp analyze` 也会写入带时间戳的 `sales_intelligence_*.md`）

#### 其他 APSales 命令

`/help` `/tools` `/tool` `/remember` `/recall` `/customer` `/pipeline` `/sales customer: <enquiry>`

### Multi-agent runtime

`runtime/runtime_config.yaml`:

```yaml
agents:
  apcoo:
    enabled: true
    telegram: true
  apsales:
    enabled: true
    telegram: true
```

`python -m runtime.service` supervises both Telegram bots independently.

### Safety boundaries

APSales cannot: deploy, delete data, modify constitution, promise final pricing/delivery/refunds, or auto-send customer messages without approval.

## Operational Safety (Audit & Recovery)

Audit trail, CEO approval records, backups, and risk classification for all tool calls.

### Audit logs (`audit/`)

| File | Contents |
|------|----------|
| `events.jsonl` | agent_start, agent_stop, deployment, approval_required, … |
| `approvals.jsonl` | CEO approval records (action, risk, approved_by, command, result) |
| `tool_calls.jsonl` | Every registered tool invocation |
| `errors.jsonl` | Runtime and tool errors |

### Risk levels

`low` → `medium` → `high` → `critical`

- **critical** (e.g. `deploy run`) — **blocked** unless command ends with `| approved`
- **high** — CEO approval required for live execution
- Dry-run / preview — allowed; logged as lower risk

### Backup & recovery

```bash
python -m runtime.backup                    # → backups/YYYY-MM-DD-HHMMSS/
python -m runtime.recovery list
python -m runtime.recovery restore <id>       # dry-run preview
python -m runtime.recovery restore <id> --confirm
```

Backs up: `constitution/`, `memory/`, `runtime/`, `audit/`

### Safety modules (`safety/`)

- `policy.py` — blocked actions, backup scope
- `risk_classifier.py` — auto risk before tool execution
- `approval_gate.py` — CEO approval enforcement
- `recovery.py` — backup list / dry-run restore / apply

## Architecture Rules

1. Tools are separate from agent logic.
2. Local files only (markdown + JSON) — no database yet.
3. No FastAPI, Docker, Redis, Celery, or external APIs without CEO approval.
4. Critic enforces these rules on engineer output.

## Example Test Messages

**Chat:**

```
今天我们的计划是部署COO Agent和Sales Agent。
客户问G4KD发动机多少钱，帮我回复。
```

**COO:**

```
/plan Build VIN Tool
/tasks
/review Cursor added FastAPI and wrote memory directly
/report
/remember plan | Deploy COO Telegram bot
/recall deploy
/decision Weekly priority | Focus | Inventory tool next | approved
/log
```

## Current Limitations (v0.9)

- Live production deploy still blocked by policy even with `| approved` (manual CEO execution).
- Tool Engine does not execute live deploy, git push, or WhatsApp/Telegram send (preview only).
- Memory recall is keyword-based, not semantic embedding search.
- Planner is rule-based keyword templates, not LLM planning.
- Critic is pattern-matching, not deep code analysis.
- Tasks stored in single JSON file (no concurrency locking).
- `/review` takes inline text only (no file diff ingestion yet).
- COO commands do not auto-run tasks — they create and track them.
- WhatsApp / Sales / Inventory agents do not execute tasks autonomously yet.

## Next Step: Inventory Tool

v0.4 will add `tools/inventory_tool.py` for stock CRUD over approved catalog JSON, wired to Inventory Agent and COO task completion flows.

Planned:

- `search_stock(brand, model, engine_code)`
- `get_listing(stock_id)`
- `summarize_availability()`

Still local-file based until CEO approves database layer.
