# APSALES-DECISION-001 — Sandbox Validation

## 部署

| 项 | 值 |
|----|----|
| Release ID | `REL-20260713092419-api-407be3631` |
| Git commit | `407be3631` |
| Branch | `feature/apsales-evidence-001` |
| 范围 | API lib + AsiaPower workspace Python（Sandbox 实际执行根） |
| 模式 | 保持 sandbox + CEO 白名单（未开放其他客户） |

## 生产验证（服务器）

```text
Need G4KD. → next_action=ask_engine_plate · source=commercial_decision · risk=high
```

未出现固定三件套（scope + quantity + port）。

## 本地

`python3 tests/test_commercial_decision_v1.py` → **20/20 PASS**

## 下一步

- CEO 在美国号码 Sandbox 做真实对话验证  
- Evidence 中核对 `commercial_decision` / Decision Result  
- 满 50 条场景后再考虑扩大范围（本任务不自动放开）
