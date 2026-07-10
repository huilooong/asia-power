# OPS · P0 改价事故质询报告 2026-07-10

**Task ID:** `ops-p0-price-change-incident-2026-07-10`  
**Status:** 取证完成 · CEO 已拍板 · 结案  
**CEO 质询:** 「谁改的价钱,这属于 p0 级严重事故」· 焦点 HC250546，并要求全库核对  
**CEO 拍板（2026-07-10）：** 「hc250551价格14500」→ 目标价 **USD 14500**，**无需回滚**

---

## 结论（先看这里）

| 问题 | 结论 |
|---|---|
| HC250546 价钱有没有被改？ | **没有。** 上传源 / 批准时 / 今日全部备份 / 现网均为 **USD 230** |
| 今日有没有改过别的库存价？ | **有且仅 1 条：** HC250551（Toyota 霸道） |
| 谁改的 HC250551？ | **Admin 后台人工**（Mac Chrome · `/admin/inventory.html`），不是 Release、不是批量脚本、不是 QXB 队列 |
| 今日 Agent / Release 有没有动价格字段？ | **没有。** 今日 Release 只部署代码；完整性修复只改 ppt/slug，价格差分 = 0 |
| 已恢复哪些错改价？ | **无。** 546 无需恢复；551 现网已是 CEO 指定 **14500**，**无需回滚、无需再改** |
| 批量改价脚本今天跑过吗？ | **没有。** 无 `PUT /api/half-cuts/state`；无 bash/脚本改价痕迹 |
| CEO 对 HC250551 目标价 | **14500**（书面拍板）；现网 `priceUsd=14500` 已对齐，公开页 meta 显示 EXW $14,500 |

---

## 1. HC250546 证据链（证明未改价）

| 时间点 (UTC) | 来源 | priceUsd | 备注 |
|---|---|---|---|
| 2026-07-10 00:30 | 提交 `SUB-MRE78IPL-0SV0` | **230** | 供应商上传 |
| 2026-07-10 05:48 | 批准落库 | **230** | `POST .../SUB-MRE78IPL-0SV0/approve` |
| 2026-07-10 06:03 | 今日最早备份 `bak-landrover-20260710-060511` | **230** | ppt 当时为空（展示问题，不是价钱） |
| 2026-07-10 09:45 | `bak-scirocco-20260710` | **230** | |
| 2026-07-10 10:16 | `before-hc250546-restore` | **230** | 完整性修复前 |
| 2026-07-10 10:17 / 10:23 | `.bak` / 现网 `half-cut-approved.json` | **230** | 修复只改 ppt/slug |
| 现网公开 API | `stockId=HC250546` | **230** | 已复核 |

**提交价 = 批准价 = 各备份价 = 现网价 = 230。**  
CEO 感知的「价钱被改」，与同日「专门变速箱像消失」为同一事故表象：批准丢 `passengerPartType` + 错 slug + 借图逻辑误伤展示，**价格字段从未漂移**。

现网详情：  
https://asia-power.com/half-cuts/detail.html?slug=volkswagen-sagitar-2014-passenger-transmission-hc250546

---

## 2. 今日最早备份 → 现网：全部价格变化

对比基准：

- **今日最早批准备份：** `data/half-cut-approved.json.bak-landrover-20260710-060511`（2026-07-10 06:03 UTC，504 条）
- **现网：** `data/half-cut-approved.json`（2026-07-10 10:23 UTC，505 条）
- **昨末参考：** `data/_backups/half-cut-approved.before-truck-cab-fix-20260710-051500.json`（Jul 9，497 条）→ 与现网对已存在条目 **0 条价差**

### 价格变化表

| 库存号 | 旧价 (06:03) | 新价 (现网) | 时间 (UTC) | 操作者 / 路径 |
|---|---|---|---|---|
| **HC250551** | **10500** | **14500** | **2026-07-10 06:18:23** | Admin 人工 `PATCH /api/half-cuts/inventory/HC250551` · Referer=`admin/inventory.html?tab=approved` · UA=Mac Chrome/149 |
| HC250552 | （不存在） | 2500 | 09:24:49 | 新批准 `SUB-MREP68GZ-I07B`（新建，非改价） |

**除此以外：0 条既有库存 priceUsd 变化。**  
其它价格类字段（`price` / `fobPriceUsd` / `exw`）今日最早→现网：**无漂移**。

连续快照差分（只看 priceUsd）：

| 区间 | 价变条数 |
|---|---|
| Jul9 truck → 今日 06:03 landrover | 0 |
| 06:03 landrover → 09:45 scirocco | **1（HC250551）** |
| 09:45 → 10:16 before-546-restore | 0 |
| 10:16 → 10:17 bak → 现网 | 0 |

---

## 3. HC250551 完整价钱时间线（今日唯一改价）

车型：2013 Toyota 霸道 · `SUB-MRBBIA20-NITL` · 供应商姚东

| 时间 (UTC) | 事件 | 提交价 | 批准库价 | 证据 |
|---|---|---|---|---|
| ≤ Jul9 / 批准前 | Pending 上传源 | **15000** | — | `half-cut-submissions.before-truck-cab-fix-20260710-051500.json` |
| 05:51:15 | Admin 批准（审核卡可改价） | **10500** | **10500** | 批准 API + landrover 备份；提交与批准一致 |
| 06:18:23 | Admin 已批准页 PATCH | **14500** | **14500** | nginx access.log + `updatedAt=2026-07-10T06:18:23.904Z`；`updateApprovedInventory` 同步回写提交价 |
| 10:17 | 完整性审计补 ppt/slug | 14500 | 14500 | **价格未动**（仅 `passengerPartType=other` 等） |

### 谁改的（责任路径）

1. **05:51 批准改价 15000→10500**  
   - 路径：Admin 审核批准流程（`POST /api/half-cuts/submissions/SUB-MRBBIA20-NITL/approve`）  
   - 浏览器：Mac · Chrome/149 · `admin/inventory.html?tab=pending`  
   - 同会话 05:48–05:51 连续批准 HC250545–551  

2. **06:18 已批准页再改 10500→14500**  
   - 路径：`PATCH /api/half-cuts/inventory/HC250551`（`updateApprovedInventory`）  
   - 浏览器：同一类 Mac Chrome/149 · `admin/inventory.html?tab=approved`  
   - **不是** Cursor Agent UA（Cursor UA 出现在 06:18:39 登录页，晚于 PATCH）  
   - **不是** Release 写库（06:18:09 仅服务重启；Release 快照不含 `half-cut-approved.json`）  
   - **不是** `putState` 批量写（今日无 PUT state）  

3. **账号推断（有证据边界）**  
   - `gooddlong@gmail.com` OAuth 注册/登录在 **06:50**，晚于两次改价 → **排除**  
   - 当时 Admin 可用账号为密码账号 **`admin-1`（username=`admin`）**  
   - nginx 未记 cookie/userId；**无法在日志里打印真人姓名**，只能定到：**持有 admin 密码、在 Mac Chrome 操作 Admin 库存页的人**  
   - 若 CEO 本人未在 06:18 改这条，需立刻轮换 admin 密码并查是否他人共用

---

## 4. 今日 Release / Agent 是否触碰价格？

| 检查项 | 结果 |
|---|---|
| 今日全部 `REL-20260710*` | 部署代码/静态资源；**无**把 `half-cut-approved.json` 打进 release 数据覆盖 |
| 完整性修复 10:17 | 改 HC250546/549/551 的 ppt/slug；**价格差分 = 0** |
| 批量改价护栏代码 | 今日上线（见下）；**护栏本身不改价** |
| QXB 队列 / 上传脚本 | 今日无对已批准库的批量 price 写入痕迹 |
| `PUT /api/half-cuts/state` | 今日 **0 次** |

---

## 5. 批量改价脚本与护栏

| 项 | 事实 |
|---|---|
| 今日是否跑过批量改价脚本 | **否**（无 state PUT、无脚本改价、备份差分仅 1 条且对应单条 PATCH） |
| 护栏「禁止一次改 ≥3 条」何时加上 | **2026-07-10 完整性审计**写入 `lib/half-cut-api.js` 的 `putState`；生产首次带该字符串的 API Release = **`REL-20260710102326-api`**（随后 `REL-20260710102505-api`）；本地尚未 git commit |
| 护栏之前有没有批量改 | 可核对的历史备份（Jul2→Jul7→Jul9）**未发现 ≥3 条同时价漂**；Jul7 有单条 HC250488：3800→900（前切修正，提交源现为 900，属更早人工/修复，非今日） |

护栏含义：一次 `putState` 若改 ≥3 条 `priceUsd`，必须 `allowBulkPriceUpdate:true` 或环境变量授权，否则拒绝。

---

## 6. CEO 可能指的「其它车」抽查

| 库存 | 现网价 | 说明 |
|---|---|---|
| HC250546 专门变速箱 | 230 | 未改价；曾「像消失」 |
| HC250551 霸道 Part | 14500 | **今日唯一改价**（人工） |
| HC250549 / 550 / 548 / 547 | 与批准时一致 | 今日备份→现网无价漂 |
| HC250488 | 900 | Jul7 前切修正后稳定；非今日 |
| 专门发动机 / 底盘 | 现网无专门条目 | 无价可改 |

若 CEO 记忆中的「被改价」不是 546 的 230，请对照 **HC250551（10500↔14500，上传源曾 15000）** 是否即所指车辆。

---

## 7. 恢复动作

| 库存 | 是否错改需回滚 | 动作 |
|---|---|---|
| HC250546 | 否（从未改价） | **不回滚价格** |
| HC250551 | 人工改价，非脚本误伤 | **CEO 拍板目标价 14500**。现网已是 14500（文件 + 公开页），**无需回滚、无需 Release 改价** |

### CEO 拍板复核（2026-07-10）

| 检查 | 结果 |
|---|---|
| 现网 `half-cut-approved.json` HC250551 `priceUsd` | **14500** |
| 公开详情 meta | EXW **$14,500** USD · HTTP 200 |
| 是否改动其它车价 | **否**（本轮零写库） |
| 验证 URL | https://asia-power.com/half-cuts/detail.html?slug=toyota-2013-passenger-part-hc250551 |

---

## 8. 如何防止再发生

| 措施 | 状态 |
|---|---|
| `putState` ≥3 条改价需 `allowBulkPriceUpdate` | **已上生产**（`REL-20260710102326-api` 起） |
| 批准保留 `passengerPartType` / 专门件展示修复 | 已上（防「像被删/像改价」误判） |
| **缺口：单条 Admin PATCH / 批准改价无操作者审计日志** | **待做**：每次改 `priceUsd` 写 `actor userId + before + after + ts` 到 jsonl |
| **缺口：admin 密码账号与真人绑定不清** | **待做**：禁用共用 `admin` 或强制每人独立账号；改价后可追到邮箱 |
| Release 禁止覆盖库存 JSON | 现状已遵守；继续经 Release Manager，数据文件不进 chrome/api 包 |

---

## 9. 验证证据

| 检查 | 结果 |
|---|---|
| 今日最早 bak → 现网 priceUsd 差分 | 仅 HC250551：10500→14500 |
| HC250546 全链路 | 230 全程一致 |
| nginx 今日 inventory PATCH | 仅 1 次：HC250551 @ 06:18:23 |
| nginx 今日 state PUT | 0 |
| 现网文件 `half-cut-approved.json` | 546=230 · 551=14500 |

---

## Paths

- 本报告：`docs/ops/ops-p0-price-change-incident-2026-07-10.md`
- 本地绝对路径：`/Users/longhui/Desktop/AsiaPower/docs/ops/ops-p0-price-change-incident-2026-07-10.md`
- 前序审计：`docs/ops/ops-inventory-integrity-audit-2026-07-10.md`
- 生产数据：`/root/.openclaw/workspace/inventory-site/data/half-cut-approved.json`
- 今日最早备份：`.../half-cut-approved.json.bak-landrover-20260710-060511`

## Next

1. ~~CEO 确认 HC250551 目标价~~ → **已拍板 14500，结案，无需回滚。**  
2. 补价格审计日志 + 停用共用 admin 密码（防下次无法点名到人）。
