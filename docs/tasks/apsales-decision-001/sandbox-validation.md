# APSALES-DECISION-001 — Sandbox Validation

## 部署范围

仅美国号码白名单 WhatsApp Sandbox（CEO wa_id）。不开放其他真实客户。

## 部署前本地证据

| 检查 | 结果 |
|------|------|
| `python3 tests/test_commercial_decision_v1.py` | 20/20 PASS |
| sandbox_reply `Need G4KD.` | `next_action=ask_engine_plate` · source=`commercial_decision` |
| 固定三件套 | 本地路径已消除 |

## 部署后（待 Release）

| 项 | 状态 |
|----|------|
| Release ID | （部署时填写） |
| Sandbox 模式仍为 sandbox | 必验 |
| 白名单仍仅 CEO | 必验 |
| 50 条场景测试 | 部署后执行；本文件先记本地通过 |

## 决策

扩大范围须等 Evidence Review（Phase 6），本任务不自动放开。
