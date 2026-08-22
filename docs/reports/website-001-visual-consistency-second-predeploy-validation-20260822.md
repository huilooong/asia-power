# WEBSITE-001 — Visual Consistency V1 第二次部署前验证

- 日期：2026-08-22（Africa/Accra）
- 分支：`codex/visual-consistency-v1-production`
- 基线提交：`2efdd7d94520`
- 发布目标：`visual-v1`
- 当前结论：**NO-GO（实现验收通过；尚未推送 GitHub，禁止部署服务器）**

## 1. 生产实现边界

本次是“全站展示栈”变更，不是 API、数据库或库存数据变更。

- 188 个公共 HTML 外壳接入同一 V1 视觉层与品牌显示层。
- 199 个 HTML 外壳纳入精确发布清单；其中 11 个后台/上传/PWA 外壳仅更新共享脚本缓存键，不加载公共视觉层。
- 8 个共享展示资产：V1 CSS、品牌显示、共享导航/页脚、多语言、首页、目录/详情 CTA、询价单。
- 207 个服务器精确目标路径；不执行全目录同步，不使用 `--delete`。
- 2 个 Release Manager 文件负责 GitHub 前置门禁、精确快照、远端校验和回退元数据。
- 未修改 `server/`、`data/`、数据库、上传目录、库存 JSON、图片/视频记录、URL 路由和询价提交接口。

## 2. 已修复的 P0 问题

1. 首页、目录、详情、品牌、指南、国家页、联系页、询价单和供应商入口使用同一共享导航、搜索与页脚。
2. 墨黑、暖金、米灰、可信深绿与 WhatsApp 绿形成单一颜色语义；主报价 CTA 为暖金，WhatsApp 为绿色次通道。
3. 商品卡片统一 4:3 媒体框、原图 `contain`、名称/规格/年份状态/EXW/证据/询价顺序。
4. 可见汽车品牌统一大写；SEO 标题、JSON-LD、URL、表单值与库存源数据保持原值。
5. 验证标签严格绑定 `supplierVerified`；未验证商品不再显示 “Verified export listing”。
6. 中文询价单和详情页不再混入 `List`、`Seller`、`Available`、`Add to quote list`。
7. 中文、英文、法文、阿拉伯文共享导航、账户入口、CTA、询价单和可信证据文案一致；阿拉伯文为 RTL，Logo 强制保持 `AsiaPower` 顺序。
8. 删除首页未验证的 `110+` 目的地、`24h` 指标，首页统计只来自当前库存集合。
9. 修复 Release Manager 将 `index.html` 截成 `ndex.html` 的 porcelain 解析错误。
10. `js/components.js`、`js/path-utils.js`、`js/half-cut-detail.js` 缓存键统一为 `site-visual-v1-20260822`。

## 3. 自动化验证

| 检查 | 结果 |
|---|---:|
| 修改 JS/MJS 语法 | PASS |
| `git diff --check` | PASS |
| Node 聚焦回归 | 34/34 PASS |
| Python 公共库存隐私测试 | 5/5 PASS |
| 缓存版本一致性 | PASS，0 个不一致资产 |
| V1 公共页面覆盖 | 188 个 |
| 精确 HTML 发布清单 | 199 个 |
| 精确服务器目标 | 207 个 |
| SEO 标题文本/描述/canonical/JSON-LD 与基线一致 | PASS（199 个外壳逐一比较） |
| API/库存/数据库/上传/媒体变更边界 | PASS，0 个越界文件 |
| 现网关键 URL | 17/17 PASS |

## 4. 桌面端 × 移动端 × 多语言矩阵

| 页面族 | Desktop | Mobile | EN | ZH | FR | AR/RTL |
|---|---:|---:|---:|---:|---:|---:|
| 首页 | PASS | PASS | PASS | PASS | PASS | PASS |
| 半切车目录 | PASS | PASS | PASS | PASS | PASS | PASS |
| 商品详情 | PASS | PASS | PASS | PASS | PASS | PASS |
| 发动机目录 | PASS | PASS | PASS | PASS | PASS | PASS |
| 卡车目录 | PASS | PASS | PASS | PASS | PASS | PASS |
| 工程机械目录 | PASS | PASS | PASS | PASS | PASS | PASS |
| 出口二手车目录 | PASS | PASS | PASS | PASS | PASS | PASS |
| 品牌页 | PASS | PASS | PASS | PASS | PASS | PASS |
| 询价单 | PASS | PASS | PASS | PASS | PASS | PASS |
| 联系/账户入口 | PASS | PASS | PASS | PASS | PASS | PASS |

浏览器验收包含：无横向溢出、共享导航/页脚挂载、移动菜单开合、品牌大写、主/次 CTA 顺序、中文禁用英文残留、阿拉伯语 RTL、验证标签门控。

## 5. 数据与业务逻辑保护证据

- 现网公共库存 API 验证前后 SHA-256 均为：`eefe913cdc95258945cb8617b66c9e9d52b9bfc89f3caa13de9606a6e8b6a1e1`。
- 现网库存保持 599 条：Available 597，Reserved 2。
- `HC250361` 保持：Toyota Yaris、Available、USD 1100、`supplierVerified=true`、4 张公开照片。
- 新 V1 CSS 与品牌脚本现网均为 404，证明尚未发生部署。

## 6. 发布与回退

强制顺序：

1. 本地候选提交且工作树 clean。
2. 推送 GitHub 并确认远端提交哈希等于本地 HEAD。
3. Release Manager 以 `visual-v1` 目标执行远端完整备份和 207 路径精确快照。
4. 使用 `rsync -avR` 同步精确清单；不使用 `--delete`。
5. 远端清单校验、API 健康检查、17 个关键 URL、公共解析器、缓存和多语言冒烟全部通过。
6. 任一失败保持 NO-GO，并按 Release ID 恢复精确快照。

## 7. GO 门禁

实现与本地/只读生产验证均已通过，但 GitHub 推送尚未执行，因此当前必须保持 **NO-GO**。只有完成 GitHub 推送、远端哈希确认，并让 Release Manager 的 `git_clean`、`git_pushed`、备份、目标确认全部 PASS 后，才允许改为 **GO**。
