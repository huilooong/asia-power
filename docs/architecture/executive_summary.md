# Executive Summary

Audit date: 2026-07-04

## Q1: 目前 AsiaPower 真正已经完成了多少？

约 60-70% 的产品基础已经完成，约 35-45% 的运营自动化达到可控生产状态。

已完成度最高的是：公开网站、半切/库存目录、供应商上传、Node API、VIN/QXB 批处理、基础 SEO、站内 analytics、APCOO/APSales/APInventory 的内部 AI OS 骨架。

未真正完成的是：统一 CRM、稳定增长自动化、统一审批网关、跨渠道归因、社媒/邮件/Maps 的安全运营闭环。

## Q2: 现在最大的技术债是什么？

最大技术债是“业务能力通过脚本堆出来，而不是通过清晰系统边界沉淀出来”。

具体表现：

- `scripts/` 同时包含安全工具、一次性 patch、生产部署、Cloudflare/Resend 配置、Facebook 自动化、QXB 上传。
- `customer_gateway/` 同时负责只读分析、草稿、邮件发送、社媒发帖、Maps 获客和仪表盘。
- Node 和 Python 都在做 email、analytics、approval/growth 的一部分。
- 高风险外发动作没有统一的 outbound action gate。

## Q3: 如果继续开发，会最容易失控的地方在哪里？

最容易失控的是 APSales Growth / Customer Gateway / Social Browser 三者交界处。

这里有真实外部动作：Facebook 加好友、入组、发帖、DM、邮件发送、Maps 抓取、Telegram/WeCom 通知、cron/launchd 调度。继续加功能会导致重复发送、账号限流、审批语义混乱、客户数据泄露、报告数据无法追溯。

## Q4: 如果你是 CTO，第一刀会砍哪里？

第一刀砍“自动外发和多入口社媒自动化”。

不是删除代码，而是冻结入口：

- 暂停旧 Facebook 单项脚本的定时运行。
- 只保留一个手动审批入口：`apsales-zijing-run.py` 或未来统一 Growth Runner。
- 所有 email/social/WeCom/Telegram 外发必须先进统一 outbound approval log。
- Cloudflare/Resend/deploy 脚本移出日常 scripts 路径，归入 ops 受控区。

## Q5: 未来 30 天建议开发路线

第 1 周：冻结高风险增长自动化，建立脚本分级和 scheduler inventory。明确哪些 cron/launchd 可运行，哪些只能手动运行。

第 2 周：重构边界。把 `customer_gateway` 拆成 read-only intelligence、draft approval、email gateway、growth queue、social adapter 五个职责层。

第 3 周：做统一 Outbound Action Gateway。所有邮件、社媒、Telegram、WeCom、生产部署都必须记录 actor、target、payload summary、approval id、dry-run、rate-limit。

第 4 周：恢复可控增长。只上线三条闭环：SEO/analytics、网站 leads -> email draft -> CEO approval、Maps leads -> draft queue。Facebook/TikTok 先保留内容生产和人工发布，不做自动外发扩张。

## CTO Verdict

AsiaPower 不是“没做出来”，而是已经做出很多，但系统边界开始模糊。下一阶段不应继续堆功能，应先把外发、增长、客户数据、调度和部署统一治理。否则最先坏的不是网站，而是运营可信度。

