# Long-term Memory

AsiaPower **长期共识**。改这里 = 改公司默认假设；需 CEO 知情。

## 只保存什么

**只保存已沉淀的共识。**

可以写：跨任务仍有效的原则、边界、禁止事项。

## 不保存什么

| 禁止写入 | 应去何处 |
|----------|----------|
| 日报 / 流水 | `10-Daily/` |
| 聊天记录 | 不进 Brain |
| 未拍板想法 | CEO Review 草稿或 Proposed Decision |
| 完整 Evidence | 服务器 ndjson；Brain 仅 Summary |
| 代码与实现细节 | Git 业务仓库 |
| 单次会议流水 | `09-Meeting/` 只留决议 |

一条检验：半年后是否仍应默认遵守？否 → 不要写进 Long-term Memory。

## 共识清单

1. **正式名称：AsiaPower Brain** — 唯一长期知识库；路径 `AsiaPower-Brain/`。
2. **Business First** — 真实买卖优先于技术表演。
3. **Evidence First** — 用客户结果与 Decision Result 进化；不靠感觉 alone。
4. **Decision First** — 学 Decision，不学整段 Reply 文本当真理；Decision 有生命周期。
5. **Roadmap ≠ Production** — 规划不等于已上线。
6. **North Star 校准方向** — 见 [[00-Vision/North-Star|North Star]]；不等于本季功能清单。
7. **Vehicle Intelligence 是能力，不是愿景** — VIN / OE / 铭牌 / 照片是能力沉淀；VIN Phase 1 ≠ 最终。
8. **Obsidian 是唯一 Brain 载体** — 禁止第二套知识系统；旧 `obsidian/AsiaPower-AI-Memory` 迁入前只读。
9. **Evidence 只存摘要进 Brain** — 完整 ndjson 在服务器。
10. **QXB 不服务 APSales** — QXB 属子龙上传链路；APSales VIN 走独立 Provider 链。
11. **生产部署** — commit → push → Release Manager；禁止常态脏树直推。
12. **Truth Guard 独立** — Customer → Decision → Truth Guard → Reply → CEO → Customer Result → Decision Result。

## 相关

- [[01-Constitution/Constitution|Constitution]]
- [[00-Vision/Vision|Vision]]
- [[00-Vision/North-Star|North Star]]
