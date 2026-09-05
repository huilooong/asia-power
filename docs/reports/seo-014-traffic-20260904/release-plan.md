# SEO-014 技术修复发布清单

状态：用户已明确授权修复并部署上线，以及持续跟进和修复流量问题。待执行Release Manager发布。

## 拟发布范围

| 本地文件 | 生产文件 | 目的 |
|---|---|---|
| robots.txt | /root/.openclaw/workspace/inventory-site/public/robots.txt | 允许公开库存渲染接口被抓取，保留其他排除规则 |
| server/lib/analytics-request-filter.js | /root/.openclaw/workspace/inventory-site/lib/analytics-request-filter.js | 排除已知扫描路径 |
| server/lib/site-analytics.js | /root/.openclaw/workspace/inventory-site/lib/site-analytics.js | 接入扫描过滤 |

周报措辞修正在本地 `scripts/analytics-weekly-report.py` 生效，不需要生产API发布。

用户已批准继续修复上线；G4KD预览内容已应用到正式页面，保留现有询价与追踪行为，生成器会保留人工审阅页。此页纳入本次限定发布。

## 基线校验

2026-09-04读取生产文件SHA-256，与本地HEAD原始版本完全一致：

- `lib/site-analytics.js`: `39f30319a23b71fa59acb10b658b303c2ce8604d71bdd9525ac4f85769650227`
- `public/robots.txt`: `f52e0c74d18098ed5220de2b1f18742597dc03a2490f2b2268c1809864b8795f`
- 生产尚不存在 `lib/analytics-request-filter.js`。

发布时必须重查哈希，防止覆盖本轮之后的新改动。生产工作区存在大量运行时数据和其他变更，不能以生产Git状态为由清理或复位。

## 发布与验收

1. 从干净隔离工作区收集本次文件与测试，核查不带入其他改动；遵循提交、推送、Release Manager发布流程。
2. 核实发布脚本的实际传输清单。现有 `api` 目标会同步整个lib目录、服务配置等；不得直接用它捎带发布所有混合工作区内容。已增加 seo-traffic 限定目标，只传输robots、统计模块及其过滤器、G4KD页面4个文件；要求快照成功、原文件哈希一致，安装失败自动恢复。
3. 发布前备份这3个目标路径，记录新增文件原先不存在的状态；运行过滤测试和语法检查。
4. 发布后检查服务健康，外网读取robots并以独立解析器验证规则；检查公开库存和至少一个真实商品详情，确认管理接口的身份验证行为没有改变。
5. 用隔离测试验证探测请求不计数、正常商品搜索仍计数。避免把大量生产自测混进访客统计；不提交真实询价。
6. 在GSC实时测试相关目录；只有在确认渲染恢复后才提交修复验证。索引报告有延迟，不能在提交后立即宣称恢复。
7. 后续用相同完整窗口核对GA4/GSC及有效询盘，区分技术通过与商业效果。

回滚：通过本次Release Manager记录恢复两个旧文件及新增文件状态，再验证服务。历史统计、库存、客户记录不应改变。

本次已通过：66项robots规则检查；3项统计回归测试；统计模块语法检查；周报文案检查；192个现网静态URL检查；G4KD预览桌面/手机目视检查。尚未进行生产发布验收、全量参数商品URL审计或完整法语/阿语体验测试。

## 本次执行补充

- 发布入口：`node scripts/deploy-production.mjs seo-traffic --yes`，从干净隔离工作区执行；不使用dirty/unpushed绕过。
- 不改生产服务配置、数据库或客户数据；安装统计模块后重启现有服务。
- 心跳自动化ID `asiapower`，每6小时检查；每周一次汇总，无变化时保持安静。
- 生产G4KD原始SHA-256：`99c49b8474b85c59f9acf38cee297dd525903a313a064d1e5bcb52ac45935907`。

生成器实测：重新生成49页、保留1页；G4KD字节无变化。测试生成的其余页面与站点地图已在隔离工作区恢复，不进入本次发布。

## 最终执行状态（2026-09-05）

已部署并复查通过；最终范围为5个文件（含补齐的共享样式）。此前未发布状态仅为历史记录。详见 [上线与跟进记录](deployment-20260905.md)。
