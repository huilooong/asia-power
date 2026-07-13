# APSALES-DECISION-001 — Local Test Results

**命令：** `python3 tests/test_commercial_decision_v1.py`  
**结果：** 20/20 PASS

| # | 场景 | 结果 |
|---|------|------|
| 1 | 首次 Need G4KD | PASS → ask_engine_plate / high risk |
| 2 | 批发 10 G4KD | PASS → 不强制身份；推进商业字段 |
| 3 | 维修工无证据 | PASS → plate/photo/vin |
| 4 | VIN 无发动机照片 | PASS → 单 NBA，非三件套 |
| 5 | VIN vs 铭牌冲突 | PASS → conflict / manual |
| 6 | VIN 失败 | PASS → 单项证据，非 qty/port |
| 7 | 铭牌清晰 | PASS → conf≥0.90 推进 |
| 8 | 照片低置信 | PASS |
| 9–11 | 不重复 scope/qty/port | PASS |
| 12–13 | Best price 可信/不可信 | PASS |
| 14 | 高风险人工 | PASS |
| 15 | ≥90% 推进 | PASS |
| 16 | 无固定三件套（VI 桥） | PASS |
| 17 | 无内部标签 | PASS |
| 18 | 无未验证承诺 | PASS |

执行反馈另存：`docs/tasks/apsales-decision-001/test-results.out.json`
