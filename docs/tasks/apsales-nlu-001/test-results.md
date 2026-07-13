# APSALES-NLU-001 — Test Results

**Date:** 2026-07-13  
**Runner:** `.venv-qxb/bin/python3`

## Summary

| Suite | Result |
|-------|--------|
| `tests/test_apsales_nlu_001.py` | **12/12 PASS** |
| `tests/test_commercial_decision_v1.py` | **20/20 PASS** |

原始输出：`docs/tasks/apsales-nlu-001/test-results.out.txt`

## 关键回归

```
2sz
→ ask_engine_plate（可提铭牌一次；提及 2SZ）
→ Engine code is 2sz
→ ask_engine_photo（承认 confirming 2SZ；不得再 ask_engine_plate）
```

## 覆盖对照（任务第十三节）

| # | 场景 | 状态 |
|---|------|------|
| 1 | `2sz` | PASS |
| 2 | 再次 `2sz` | PASS（action/reply 不重复） |
| 3 | `Engine code is 2sz` | PASS |
| 4 | mechanic said 2sz | PASS |
| 5 | maybe 2sz | PASS（hedged conf） |
| 6 | not 2sz, it is 3sz | PASS |
| 7 | don’t have plate | PASS |
| 8 | No plate, can send photo | PASS |
| 9 | VIN 作替代 | PASS |
| 10 | 图片事件 | 路径已接 media_type（sandbox） |
| 11–16 | 死循环 / 不重复 | PASS |
| 12 | customer_reported ≠ verified | PASS |
| 17 | 新证据重算 | PASS（澄清后改 photo） |
| 18–19 | 无内部标签 / 无虚假承诺 | CDR V1 回归 PASS |
| 20 | CDR V1 全套 | PASS |
