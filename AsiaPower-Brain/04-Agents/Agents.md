# Agents

智能体职责边界（摘要）。详细实现不在 Brain。

| Agent | 职责 | 不做什么 |
|-------|------|----------|
| APSales | 销售对话、Decision、Vehicle Intelligence 入口 | 不当 Coach 写回；不接 QXB 上传 |
| APCOO | 运营协作 | 不替代 CEO 拍板 |
| Cursor | 改代码、预览、部署流程执行 | 不擅自对外群发 / 删数据 |
| CTO (ChatGPT) | 战略与架构讨论；靠 brain-summary 恢复上下文 | 不把聊天当正式 Decision |
| CEO | 最终拍板、CEO Review | — |

## 相关

- [[06-Decisions/Decision-Log|Decision Log]]
- [[04-Agents/README|README]]
