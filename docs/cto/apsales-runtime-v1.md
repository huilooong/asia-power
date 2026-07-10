# APSALES-001 — APSales Production Runtime v1

**Status:** Complete  
**Date:** 2026-07-05  
**Phase:** AI Runtime (post Infrastructure Alpha)

---

## 结论

APSales 现已具备 **24/7 生产运行时基础**。本次只建运行时骨架，**不含业务逻辑、不含 Prompt**。

| 能力 | 状态 |
|------|------|
| Agent 生命周期 | ✅ startup / shutdown / restart / health |
| 持久化 Memory | ✅ customer / conversation / supplier / learning |
| Task Queue | ✅ inquiry / follow_up / reminder / retry |
| Tool Framework | ✅ VIN/Inventory/WhatsApp 实装 + 6 个未来工具 stub |
| Scheduler | ✅ 24h / 3d / quotation / supplier 提醒 |
| Event Bus | ✅ 9 种内部事件 |
| 决策日志 | ✅ JSONL 可追溯 |
| 多模型 + Failover | ✅ config 驱动 |
| 重启恢复 | ✅ queue + schedule + state |
| 文档 | ✅ 本文 |

---

## 架构概览

```mermaid
flowchart TB
  subgraph service [APSales Runtime Service]
    LC[AgentLifecycle]
    WK[Workers]
    EB[EventBus]
    TG[Telegram Supervisor]
  end

  LC --> MEM[MemoryStore]
  LC --> TQ[TaskQueue]
  LC --> SCH[Scheduler]
  LC --> TF[ToolFramework]
  LC --> REC[RecoveryManager]

  EB -->|InquiryReceived| TQ
  EB -->|CustomerCreated| SCH
  EB -->|QuoteCreated| SCH

  WK --> SCH
  WK --> TQ
  WK --> LC

  TG --> APSales Bot
```

---

## 启动方式

```bash
# 一次性自检（bootstrap + healthcheck）
python scripts/apsales-runtime.py --once

# 本地开发（无 Telegram）
python scripts/apsales-runtime.py --no-telegram

# 生产 24/7（systemd）
sudo cp deploy/apsales-runtime.service /etc/systemd/system/
sudo systemctl enable --now apsales-runtime.service
```

生产路径：`/root/.openclaw/workspace/AsiaPower`

---

## 1. Agent 生命周期

| 阶段 | 模块 | 行为 |
|------|------|------|
| startup | `apsales_runtime/lifecycle.py` | bootstrap constitution/memory/tools → recovery → running |
| shutdown | 同上 | 停止 worker → 持久化 state → stopped |
| restart | 同上 | shutdown + startup，递增 restart_count |
| health | `worker.py` + `healthcheck.py` | 60s 心跳、queue 摘要、model router 状态 |

状态文件：`data/apsales_runtime/state.json`  
心跳日志：`data/apsales_runtime/heartbeat.jsonl`

---

## 2. 持久化 Memory

| Scope | 路径 | 用途 |
|-------|------|------|
| customer | `memory/customers/` | CRM 客户档案 |
| conversation | `memory/customer_gateway/` | 入站消息、draft queue |
| supplier | `memory/suppliers/` | 供应商记录 |
| learning | `memory/learning/` | 销售学习数据 |

访问层：`apsales_runtime/memory.py` → `MemoryStore`

---

## 3. Task Queue

| 类型 | 用途 |
|------|------|
| `inquiry` | 新询盘 |
| `follow_up` | 跟进任务 |
| `reminder` | 定时提醒 |
| `retry` | 失败重试 |

存储：`data/apsales_runtime/queue/task-*.json`  
模块：`apsales_runtime/task_queue.py`

崩溃恢复：启动时将 `processing` 任务重置为 `pending`。

---

## 4. Tool Framework

| Tool | 状态 |
|------|------|
| vin | 已接入 `tools/registry` |
| inventory | 已接入 |
| whatsapp | 已接入 |
| telegram | 已接入 |
| email | stub（已注册，待业务 handler） |
| browser | stub |
| search | stub |
| pricing | stub |
| translation | stub |
| memory | 路由到 MemoryStore |

模块：`apsales_runtime/tools.py`

---

## 5. Scheduler

| 规则 | 延迟 | 产出任务 |
|------|------|----------|
| `follow_up_24h` | 24 小时 | follow_up |
| `follow_up_3d` | 72 小时 | follow_up |
| `quotation_reminder` | 48 小时 | reminder |
| `supplier_reminder` | 24 小时 | reminder |

存储：`data/apsales_runtime/schedule.jsonl`  
配置：`config/apsales_runtime.yaml`

---

## 6. Event Bus

| 事件 | 运行时动作（基础设施层） |
|------|-------------------------|
| `CustomerCreated` | 排程 follow_up_24h |
| `InquiryReceived` | 入队 inquiry |
| `QuoteCreated` | 排程 quotation_reminder |
| `SupplierMatched` | 排程 supplier_reminder |
| `QuoteApproved` | 审计日志 |
| `VINDecoded` | 审计日志 |
| `InventoryUpdated` | 审计日志 |
| `PaymentReceived` | 审计日志 |
| `ShipmentCreated` | 审计日志 |

存储：`data/apsales_runtime/events.jsonl`  
模块：`apsales_runtime/events.py`

```python
from apsales_runtime.events import EventBus, EVENT_INQUIRY_RECEIVED
bus = EventBus()
bus.publish(EVENT_INQUIRY_RECEIVED, {"channel": "whatsapp", "customer_hash": "abc"})
```

---

## 7. 决策日志

每次队列/调度/生命周期/事件决策写入：

- `data/apsales_runtime/decisions.jsonl`
- `audit/events.jsonl`（`apsales_decision` 事件）

模块：`apsales_runtime/logging.py`

---

## 8. 配置

文件：`config/apsales_runtime.yaml`

| 区块 | 内容 |
|------|------|
| `models` | primary / fallback / failover_on_errors |
| `multi_agent` | apcoo / apinventory 协作开关 |
| `lifecycle` | health / heartbeat 间隔 |
| `scheduler` | 规则与 tick 间隔 |
| `task_queue` | 重试策略 |
| `recovery` | 重启恢复开关 |
| `telegram` | APSales bot supervisor |

Model Router：`apsales_runtime/config.py` → `ModelRouter`

---

## 9. Recovery

| 机制 | 说明 |
|------|------|
| systemd `Restart=always` | 进程级自动重启 |
| `RecoveryManager` | 启动时恢复 queue + schedule |
| `state.json` | 上次运行 health/queue 快照 |
| Telegram supervisor | bot crash 自动重启（沿用 `runtime/supervisor.py`） |

---

## 10. 文件清单

| 路径 | 作用 |
|------|------|
| `apsales_runtime/` | 运行时核心包 |
| `config/apsales_runtime.yaml` | 配置 |
| `scripts/apsales-runtime.py` | CLI 入口 |
| `deploy/apsales-runtime.service` | systemd 单元 |
| `tests/test_apsales_runtime_foundation.py` | 单元测试 |
| `docs/cto/apsales-runtime-v1.md` | 本文 |

---

## 与 Infrastructure Alpha 的关系

| 阶段 | 范围 |
|------|------|
| OPS-001 ~ OPS-005 | 部署、Release Manager — **已关闭** |
| APSALES-001 | AI 运行时基础 — **本次完成** |
| 下一步 | 业务 handler（询盘回复、报价逻辑等）— **不在本次范围** |

---

## 验证

```bash
.venv/bin/python3 -m pytest tests/test_apsales_runtime_foundation.py -q
python scripts/apsales-runtime.py --once --no-telegram
```

---

## 下一步（产品开发）

1. 为 `inquiry` / `follow_up` 任务接入真实 handler（调用现有 `sales_core/`）
2. Email / Browser 渠道接入 Event Bus
3. 生产启用 `apsales-runtime.service`

**本次不实现上述业务逻辑。**
