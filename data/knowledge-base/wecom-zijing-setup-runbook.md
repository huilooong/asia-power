# 企业微信 · 子敬（APSales）接入 Runbook

> 归档：2026-07-01  
> Agent：**鲁肃（子敬）** = `apsales` — 群内客户回复、销售统计、询价草稿  
> 上传/VIN/库存关键词 → 自动路由 **赵云（子龙）** `apinventory`  
> 相关代码：`integrations/wecom_*`、`scripts/wecom-verify-config.py`

### 名称对照（重要）

| 企业微信里显示 | 我们内部叫 |
|----------------|------------|
| **AsiaPower 库存 Agent** | **子敬** |

- **管理后台创建应用**时，名称必须填 **`AsiaPower 库存 Agent`**（同事在群里看到的名字）。
- **子敬** 只是内部昵称/角色名（代码路由、日志、AI 回复自称仍可用「子敬」）。
- 群里 **@** 时用企业微信显示名：**@AsiaPower 库存 Agent**（不是 @子敬）。

---

## 1. 结论（CEO 必读）

| 项目 | 说明 |
|------|------|
| **电脑已登录企业微信** | ✅ 可以聊天，但 **不够** — 拿密钥必须进 **管理后台** |
| **管理后台** | 浏览器打开 [https://work.weixin.qq.com/wework_admin/frame](https://work.weixin.qq.com/wework_admin/frame)（需管理员账号） |
| **本机要先跑** | 回调服务 + **公网 HTTPS 地址**（**生产已部署** `https://asia-power.cn/wecom/callback`；本地开发才用 cloudflared） |
| **群内用法** | 把 **AsiaPower 库存 Agent** 应用拉进群 → **@AsiaPower 库存 Agent** 提问 |
| **域名主体校验** | 企业微信认证 = **南阳芃芃信息科技有限公司**；`asia-power.cn` 企业备案 ✅（2026-07-02）；`asia-power.com` 个人备案 → 仅作备用 |
| **生产回调** | ✅ 已部署在国内 Lighthouse `124.222.191.164` → `https://asia-power.cn/wecom/callback`（裸 GET 403 = 正常） |

> **2026-07-01 已知情况**：企业微信认证主体为 **南阳芃芃信息科技有限公司**；`asia-power.com` 是 CEO **个人名字**备案的。这不是 trycloudflare 问题，是 **备案主体 ≠ 企业认证主体**，系统自动校验过不去。

---

## 2. 架构（子敬在群里做什么）

```
客户/同事 @AsiaPower 库存 Agent（企业微信群；内部叫子敬）
        ↓ HTTPS POST（加密）
integrations/wecom_callback_server.py   ← 生产 124.222.191.164:8791（asia-power.cn）；本地开发 8791
        ↓ 解密 + 白名单
integrations/wecom_zijing_handler.py
        ↓ 关键词路由
   ┌────┴────┬──────────────┐
   ↓         ↓              ↓
apsales    apinventory     apcoo
(子敬)     (子龙·上传)     (孔明·战略)
   ↓
truth.verified_sales_intelligence（统计类）
sales_core / CRM 草稿（询价类）
        ↓
被动回复 XML 或 主动 appchat/send
        ↓
企业微信群内显示
```

| 用户说什么 | 谁处理 | 能力（当前） |
|------------|--------|--------------|
| 询价、报价、客户、GMV | **子敬** | LLM 草稿 + CRM；**不自动对外发消息** |
| `/sales-intelligence …` | **子敬** | 销售数据库统计（确定性报告） |
| 上传、VIN、库存、HC25 | **子龙** | 库存/QXB 查询（上传流水线 Phase 3 扩展） |
| 战略、部署、审批 | **孔明** | COO 路由 |

---

## 3. CEO 在管理后台逐步操作（技术小白版）

### 第一步：确认你是管理员

1. 打开 [企业微信管理后台](https://work.weixin.qq.com/wework_admin/frame)
2. 若只能看到「工作台」看不到「应用管理」→ 找公司管理员开通 **超级管理员** 或 **应用管理员**

> **意思**：CorpID/Secret 只有管理员能在后台看到，桌面客户端登录拿不到。

### 第二步：记下企业 ID（CorpID）

1. 管理后台 → **我的企业** → **企业信息**
2. 复制 **企业 ID** → 填入 `.env` 的 `WECOM_CORP_ID`

### 第三步：创建「AsiaPower 库存 Agent」自建应用

1. **应用管理** → **应用** → **创建应用**
2. 名称：**`AsiaPower 库存 Agent`**（必须与此一致；**不要**填「子敬」— 那是我们内部昵称）
3. 可见范围：先选 **CEO + 需要测试的同事**（以后再加供应商群成员）
4. 进入应用详情页，记下：
   - **AgentId** → `WECOM_AGENT_ID`
   - **Secret**（点击查看）→ `WECOM_AGENT_SECRET`

### 第四步：配置接收消息（回调）

1. 同一应用页 → **接收消息** → **设置 API 接收**
2. 填写（与 `.env` **完全一致**）：
   - **URL**：`https://asia-power.cn/wecom/callback`（**必须用企业备案域名**，见 §10）
   - **Token**：自己编一串英文数字 → `WECOM_CALLBACK_TOKEN`
   - **EncodingAESKey**：点「随机生成」→ `WECOM_ENCODING_AES_KEY`
3. 点保存 → 企业微信会 GET 验证 URL → 生产日志 `journalctl -u wecom-callback -f` 应出现 `[WeCom callback]`
4. 勾选接收：**用户发送的普通消息**（文本）

> **为何不能用 trycloudflare.com？**  
> 企业微信要求回调域名 **ICP 备案主体** 与 **当前企业主体相同或有关联**。`*.trycloudflare.com` 是 Cloudflare 临时隧道，没有你的备案，后台会报「域名主体校验未通过」。
>
> **注意**：域名「有备案」不够 — 还要 **备案主体** 与公司认证主体一致，或证明「关联主体」（见 §10）。个人备案的 `asia-power.com` 不能直接过校验。

### 第五步：把应用拉进客户/供应商群

1. 企业微信 **桌面端或手机** → 进入目标群
2. 群设置 → **添加群机器人/应用** → 选 **AsiaPower 库存 Agent**
3. 在群里 **@AsiaPower 库存 Agent** 发：`/ping`
4. 若成功，Agent 回复在线状态（回复里可能自称「子敬」）

### 第六步：填 `.env` 并验证

```bash
cd /Users/longhui/Desktop/AsiaPower
source .venv/bin/activate
pip install pycryptodome   # 仅首次
.venv/bin/python3 scripts/wecom-verify-config.py
.venv/bin/python3 integrations/wecom_callback_server.py
```

### 第七步（可选）：群白名单

收到第一条群消息后，日志里会有 `chat_id`。把群 ID 写入：

```bash
WECOM_ALLOWED_CHAT_IDS=wrXXXXXXXX
```

空着 = 所有群都允许（内测可用，上线建议收紧）。

---

## 4. 环境变量（复制到 `.env`，勿提交 Git）

```bash
# 企业微信 · AsiaPower 库存 Agent（内部昵称：子敬）
WECOM_CORP_ID=
WECOM_AGENT_ID=
WECOM_AGENT_SECRET=
WECOM_CALLBACK_TOKEN=
WECOM_ENCODING_AES_KEY=

# 公网 HTTPS 根地址（管理后台填的 URL = 此项 + /wecom/callback）
WECOM_PUBLIC_BASE_URL=https://asia-power.com

# 本机监听
WECOM_CALLBACK_HOST=127.0.0.1
WECOM_CALLBACK_PORT=8791
WECOM_CALLBACK_PATH=/wecom/callback

# 安全：群/用户白名单（逗号分隔，可留空=全允许）
WECOM_ALLOWED_CHAT_IDS=
WECOM_ALLOWED_USER_IDS=
WECOM_REQUIRE_AT_MENTION=1
```

完整模板见仓库根目录 `.env.example`。

---

## 5. 本地开发启动（仅调试；CEO 上线请用生产 URL）

```bash
# 终端 1 — 回调服务（需常开）
cd /Users/longhui/Desktop/AsiaPower
source .venv/bin/activate
.venv/bin/python3 integrations/wecom_callback_server.py

# 终端 2 — 公网隧道（仅开发；企业微信后台通常不接受 trycloudflare 备案校验）
# cloudflared tunnel --url http://127.0.0.1:8791
```

**CEO 上线**：无需本机常开；回调已在生产 `159.65.86.24` 运行（见 §10）。

**开机自启（可选，仅 Mac 本地）**：复制 `ops/launchd/ai.asiapower.wecom-zijing.plist` 到 `~/Library/LaunchAgents/` 后 `launchctl load`。

---

## 6. 如何测试第一条群消息

| 步骤 | 操作 | 期望结果 |
|------|------|----------|
| 1 | `.venv/bin/python3 scripts/wecom-verify-config.py` | 显示 ✅ access_token |
| 2 | 后台保存 URL `https://asia-power.cn/wecom/callback` | 验证通过无红字 |
| 3 | 群里 @AsiaPower 库存 Agent 发 `/ping` | 回复 APCOO/子系统在线状态 |
| 4 | @AsiaPower 库存 Agent 发 `客户来自哪些国家` | 子敬返回 **verified_sales_intelligence** 统计 |
| 5 | @AsiaPower 库存 Agent 发 `HC25 库存` | 路由到 **子龙** 库存回复 |

主动发测试（不经过群回调）：

```bash
.venv/bin/python3 scripts/wecom-test-send.py --chat wrXXXX --text "子敬连通测试"
```

---

## 7. 常见问题

| 现象 | 原因 | 处理 |
|------|------|------|
| **域名主体校验未通过** | ① 未备案域名（trycloudflare 等）② **个人备案** vs 企业认证 | ① 用已备案域名 ② 见 **§10 个人备案场景** |
| URL 验证失败 | Token/AESKey 与后台不一致 | 两边复制粘贴再保存 |
| 群 @ 无反应 | 应用未进群 / 未 @ / 回调未运行 | `ssh -i ~/.ssh/asiapowermac.pem root@124.222.191.164 systemctl status wecom-callback` |
| gettoken 失败 | CorpID 或 Secret 错误 | 重新复制 Secret |
| 解密失败 | 未装 pycryptodome | 生产 venv 已装；本地 `pip install pycryptodome` |
| 429 / IP 限制 | 服务器 IP 未加白 | 管理后台 → 企业可信 IP → 加 **`124.222.191.164`**（国内 Lighthouse；境外备用 `159.65.86.24`） |

---

## 8. 后续 Phase

- [x] **Phase A MVP**：群内收图 → 子龙 QXB pipeline（2026-07-02，见 `wecom-zilong-training-runbook.md`）
- [ ] Phase B：群图 OCR 发动机成长 + 群级纠错
- [ ] Phase C：多群数据飞轮 + 供应商状态看板
- [ ] 子敬无响应 >2h → 孔明 failover（见 `docs/asia-power-v3-blueprint.md`）
- [x] 生产：回调部署到国内 Lighthouse `124.222.191.164` + `asia-power.cn` HTTPS（2026-07-03）
- [x] 境外备用：`159.65.86.24` + `asia-power.com` 仍 active（域名校验过不去，勿作企微后台 URL）

---

## 9. 生产部署（已完成 · 运维参考）

| 项目 | 值 |
|------|-----|
| 服务器 | `root@124.222.191.164`（腾讯云 Lighthouse · 上海） |
| SSH | `ssh -i ~/.ssh/asiapowermac.pem root@124.222.191.164` |
| 代码目录 | `/opt/AsiaPower` |
| 回调 URL | **`https://asia-power.cn/wecom/callback`** |
| 本机监听 | `127.0.0.1:8791` |
| systemd | `wecom-callback.service` |
| nginx | `location = /wecom/callback` → `127.0.0.1:8791`（见 `deploy/nginx-asia-power.cn`） |
| 密钥 | `/opt/AsiaPower/.env`（WECOM_* + OPENAI_API_KEY） |
| 境外备用 | `159.65.86.24` · `https://asia-power.com/wecom/callback`（个人备案，企微后台勿用） |

**CEO 只需改后台 URL**，Token / EncodingAESKey **保持不变**（与 `.env` 一致）。

### 运维命令

```bash
# 状态
ssh root@159.65.86.24 systemctl status wecom-callback

# 日志
ssh root@159.65.86.24 journalctl -u wecom-callback -f

# 重新部署代码（本机 AsiaPower 目录）
rsync -az --exclude '.venv*' --exclude '.git' --exclude 'node_modules' \
  --exclude 'data/qxb-photos*' --exclude 'work/' \
  /Users/longhui/Desktop/AsiaPower/ root@159.65.86.24:/root/.openclaw/workspace/AsiaPower/
ssh root@159.65.86.24 'cd /root/.openclaw/workspace/AsiaPower && bash deploy/install-wecom-callback.sh'

# nginx 更新（若改 deploy/nginx-asia-power.com）
scp deploy/nginx-asia-power.com root@159.65.86.24:/etc/nginx/sites-available/asia-power.com
ssh root@159.65.86.24 'nginx -t && systemctl reload nginx'
```

### 首次安装 checklist（已完成 2026-07-01）

1. `rsync` AsiaPower 代码到 `/root/.openclaw/workspace/AsiaPower`
2. `python3 -m venv .venv && pip install -r requirements-ai-os.txt openpyxl pillow`
3. 写入 `.env`（WECOM_* + `WECOM_PUBLIC_BASE_URL=https://asia-power.com`）
4. nginx 增加 `/wecom/callback` 反代
5. `bash deploy/install-wecom-callback.sh`

---

## 10. 域名主体校验 · 决策树（2026-07-01）

> 官方文档：[企业内部开发配置域名指引](https://open.work.weixin.qq.com/wwopen/common/readDocument/40754)

### 10.0 决策树（CEO 一眼看懂）

**意思**：企业微信保存回调 URL 时，会查域名在工信部的 **ICP 备案主体** 是否与您企业微信 **认证主体** 一致（或有官方认可的关联关系）。

```
您要填的 URL 是什么？
│
├─ trycloudflare / ngrok 等临时域名
│   └─ ❌ 直接拒绝 → 必须用已备案的自有域名（如 asia-power.com）
│
└─ 自有域名（如 asia-power.com）
    │
    ├─ 备案主体 = 企业微信认证公司全称？
    │   └─ ✅ 路径 A：后台保存 URL，应自动通过
    │
    ├─ 不一致，但有「关联关系」？
    │   （母子公司 / 同一集团 / 同一自然人绝对控股）
    │   └─ ⚠️ 路径 B：先尝试保存；若报「主体校验未通过」→ 联系企业微信客服 + 提交关联证明
    │
    ├─ 不一致，且无关联证明？
    │   └─ 路径 A'：把域名备案迁到公司名下（2～4 周），或换公司名下已备案域名
    │
    └─ 您是第三方 SaaS 厂商代做应用？
        └─ 路径 C：代开发模式（AsiaPower 自建应用 → ❌ 不需要）
```

| 路径 | 适用谁 | CEO 现在做什么 |
|------|--------|----------------|
| **A** | 备案主体 = 企业认证全称 | 管理后台保存 **`https://asia-power.cn/wecom/callback`**（2026-07-03 已部署） |
| **B** | 有关联关系（如法人个人备案） | 保存失败 → 联系客服，交 Corpid + 全称 + 域名 + 股权/年报证明 |
| **A'** | 长期一劳永逸 | 域名备案从个人迁到公司（见 §10.6） |
| **C** | 外部 SaaS 代开发 | **不适用** — 我们自建应用、自管服务器 |

**AsiaPower 当前判断（2026-07-03 更新）**：`asia-power.cn` 企业备案已完成 → 走 **路径 A**，后台填 `https://asia-power.cn/wecom/callback` 应自动通过。`asia-power.com` 个人备案仅作境外备用，**勿填企微后台**。

### 10.1 问题是什么

| 对比项 | 当前情况 |
|--------|----------|
| 企业微信认证主体 | **南阳芃芃信息科技有限公司**（2026-07-01 CEO 确认；管理后台「我的企业 → 企业信息」可核对） |
| 对外品牌 / 法律主体 | **AsiaPower** 品牌；英国法律主体 **BSB Motors**（见 `docs/brand-v3/brand-guidelines.md`） |
| `asia-power.com` ICP 备案主体 | **个人**（CEO 个人姓名；与认证主体 **不一致** → 校验失败；以 [beian.miit.gov.cn](https://beian.miit.gov.cn) 为准） |
| 推荐新域名（公司名下） | 待购 + **企业备案** 后用于回调（见 §10.8） |
| 系统校验 | 名称不一致 → **「域名主体校验未通过」** |
| 生产回调 | ✅ `https://asia-power.cn/wecom/callback` **已部署**（2026-07-03 · 国内 Lighthouse `124.222.191.164`；裸 GET 403 = 正常） |

**意思**：ICP 备案（工信部登记）要写明「这个域名归谁」— 个人和公司算不同主体，企业微信不会自动放行。

### 10.2 关联主体（官方允许的例外）

若备案主体与企业认证主体 **不是同一个名字**，但存在 **关联关系**，可联系 **企业微信客服** 人工审核。关联主体包括：

1. 母子公司（绝对控股）
2. 总公司与分公司
3. 同一集团下属企业（同一母公司绝对控股）
4. **同一自然人控股的企业，且该自然人对企业具有绝对控股权**（最大股东 / 实际控制人）

第 4 条是 CEO 最可能走通的路径：**域名备案在个人名下，但这个人就是公司法人/绝对控股股东**。

### 10.3 四条路怎么选（CEO 决策表）

| 方案 | 做法 | 优点 | 缺点 | 预计时间 | 推荐度 |
|------|------|------|------|----------|--------|
| **A. 企业备案迁移** | 把 `asia-power.com` 备案从个人改到公司名下（变更备案或注销后重新企业备案） | 一劳永逸；以后任何企业微信/小程序域名都顺 | 需营业执照、法人配合；部分省份不能直接「个人→企业」，可能要短暂停站 | **2～4 周**（域名过户 1～3 天 + 管局审核 7～20 工作日） | ⭐⭐⭐ 长期最佳 |
| **B. 联系企业微信客服** | 证明「备案个人 = 南阳芃芃信息科技有限公司 法人/实控人」，提交材料人工放行 | 不用立刻改备案；可能 **几天** 搞定 | 客服裁量，不保证成功；材料要齐 | **3～7 个工作日**（客服审核） | ⭐⭐⭐ **现在就能试** |
| **C. 换企业备案域名** | 新购域名（如 `asia-power.cn`）以 **南阳芃芃信息科技有限公司** 做企业备案，用其子路径做回调 | 校验自动过；不动 `asia-power.com` 官网 | 需购域名 + 备案 2～4 周 | **2～4 周**（新购备案） | ⭐⭐⭐ **长期最稳** |
| **D. 代开发模式** | 第三方服务商代开发应用 | 适合 **外部 SaaS 厂商** 给多家企业做应用 | AsiaPower **自建应用**，自己管服务器 — **不适用** | — | ❌ 不需要 |

**结论（给 CEO）**：

1. **短期**：走 **方案 B** — 今天联系企业微信在线客服（管理后台右下角「联系我们」），话术见 §10.4。
2. **长期**：**方案 C** — 以 **南阳芃芃信息科技有限公司** 新购域名 + **企业备案**（§10.8），回调用新域名；`asia-power.com` 官网可不动。
3. 生产回调 **不用拆**；域名一通过，改后台 URL 或沿用现 URL（若 B 成功）即可。

### 10.4 方案 B — 联系客服要交什么

准备以下信息（**勿在群里发 Secret / Token**，只给客服 Corpid 等非密钥项）：

| 材料 | 说明 |
|------|------|
| 企业 Corpid | `wwe5847049fcf4b72b` |
| 企业微信认证 **全称** | **南阳芃芃信息科技有限公司** |
| 域名 | `asia-power.com` |
| 备案主体姓名 | 在 [beian.miit.gov.cn](https://beian.miit.gov.cn) 查到的个人姓名 |
| 身份证明 | 备案人身份证（客服可能要求） |
| 控制/关联证明 | 天眼查/企查查 **股权结构截图**、营业执照（法人姓名与备案人一致）、公司章程或股东名册（证明绝对控股） |

**企微客服话术（路径 B · 复制粘贴后按需改括号内容）**：

> 您好，我司企业微信 Corpid 为 **wwe5847049fcf4b72b**，认证主体为 **南阳芃芃信息科技有限公司**。  
> 回调域名 **asia-power.com** 的 ICP 备案主体为本人（法人/实际控制人）个人姓名，与企业认证主体名称不一致，保存 API 接收 URL 时提示「域名主体校验未通过」。  
> 本人为该企业的法定代表人/绝对控股股东，申请按官方 **关联主体（同一自然人绝对控股）** 规则进行人工审核。  
> 回调 URL 已部署并可正常响应验证请求：`https://asia-power.com/wecom/callback`。  
> 如需材料，我可提供：营业执照、法人身份证、备案查询截图、股权结构/天眼查截图（证明控股关系）。  
> 请协助开通该域名的回调配置权限，谢谢。

### 10.5 方案 A — 企业备案（新购域名 或 迁移 asia-power.com）

**认证主体（已确认）**：**南阳芃芃信息科技有限公司**

#### 企业备案材料清单（腾讯云 / 阿里云通用）

| 材料 | 说明 |
|------|------|
| **营业执照** | 扫描件/照片，主体名称 = 南阳芃芃信息科技有限公司 |
| **法人身份证** | 正反面；备案联系人可与法人为同一人 |
| **域名证书** | 在域名注册商下载（证明域名属于该公司） |
| **备案接入商账号** | 腾讯云或阿里云实名认证为企业（与营业执照一致） |
| **网站信息** | 备案类型选「企业」；网站名称可填 AsiaPower 或公司简称；**不涉及国内服务器托管** 时按接入商指引选「仅域名备案/不接入」或对应境外场景 |
| **法人配合** | 部分省份需法人手机刷脸验证 |

> **意思**：企业备案 = 在工信部登记「这个域名归哪家公司」；名称必须与企业微信认证全称一致，校验才会自动通过。

#### 步骤概要

1. **购域名 + 企业实名**：注册商（阿里云/腾讯云等）把域名 **持有者改为公司**（南阳芃芃信息科技有限公司），等待 1～3 天。
2. **登录 ICP 备案控制台**（与购域名同一云）→ 提交 **企业首次备案**。
3. **管局审核**：通常 **7～20 个工作日**；全程约 **2～4 周**（含域名实名 + 审核）。
4. **备案通过后** → 见 §10.8「备案完成后技术步骤」→ 企业微信后台保存新 URL。

**若坚持沿用 `asia-power.com`**（不推荐，流程更绕）：

1. 域名注册信息从个人过户到公司 → 再提交变更备案或注销后重新企业备案。
2. 部分省份不支持「个人 → 企业」直接变更，可能有 **短暂停站**。

> 服务器在 DigitalOcean（境外 IP），站点经 Cloudflare 加速；备案号主要供 **企业微信域名校验** 读取，与服务器物理位置无直接关系，但变更时按接入商指引操作。

### 10.6 现在就能做什么 / 不能做什么

| 操作 | 预期 |
|------|------|
| 后台再点保存 `https://asia-power.com/wecom/callback` | ❌ **大概率仍失败** — 系统只比对备案主体名称，不会因为你「确实是法人」就自动放行 |
| 联系企业微信客服（方案 B） | ✅ **建议今天就做** |
| 查 beian.miit.gov.cn 确认备案主体姓名 | ✅ 5 分钟 |
| 查是否有其他公司备案域名（方案 C） | ✅ 有则告知技术，改 nginx 即可 |
| 动生产回调服务 | ❌ **不需要** — 保持运行 |

### 10.7 CEO 已确认 / 待确认信息

| # | 信息 | 状态 | 用途 |
|---|------|------|------|
| 1 | 企业微信认证 **企业全称** | ✅ **南阳芃芃信息科技有限公司**（2026-07-01） | 客服材料 / 企业备案 |
| 2 | `asia-power.com` 备案主体 **姓名** | ⏳ 待 CEO 在 [beian.miit.gov.cn](https://beian.miit.gov.cn) 截图确认 | 路径 B 客服材料 |
| 3 | 备案人是否 = 公司 **法人** 且 **绝对控股股东**？ | ⏳ 待确认 | 决定路径 B 能否走通 |
| 4 | 是否还有其他 **公司名下已备案** 的域名？ | ⏳ 待确认 | 若有，路径 C 可能更快 |

---

### 10.8 CEO 行动清单 · 购域名 + 企业备案（路径 A' / 方案 C）

> **推荐**：新购一个 **公司名下** 域名做企微回调，比把 `asia-power.com` 从个人迁到公司更省事；`asia-power.com` 继续服务官网即可。

#### 购域名建议（实用为主，先查能否注册）

| 优先级 | 域名示例 | 说明 |
|--------|----------|------|
| ⭐ 首选 | `asia-power.cn` | 与品牌一致 · 企微回调主域名 |
| 可选 | `asia-power.com.cn` | 品牌保护 · 不必单独备案 |
| 备选 | `ppinfo.cn` | 短、便宜（CEO 已改选 asia-power.*） |

**购买注意**：

- 在 **阿里云** 或 **腾讯云** 购买（与备案同一平台最省事）。
- 注册时 **域名持有者** 直接填 **南阳芃芃信息科技有限公司**（不要填个人）。
- 买完下载 **域名证书**，备案时要上传。

#### 时间线（心里有数）

| 阶段 | 预计时间 |
|------|----------|
| 购域名 + 企业实名 | 1～3 天 |
| 提交企业备案 + 管局审核 | 7～20 工作日 |
| **合计** | **约 2～4 周** |

#### CEO 本周要做（按顺序）

1. **二选一决策**：  
   - **快**：今天联系企微客服走路径 B（§10.4 话术），同时准备股权/法人证明；  
   - **稳**：按上表购域名 → 同云账号提交 **企业备案**（§10.5 材料清单）。
2. 购域名时：**持有者 = 南阳芃芃信息科技有限公司**，保存域名证书 PDF。
3. 备案时：准备好 **营业执照 + 法人身份证**，按接入商页面逐步填（不懂就点「备案助手」）。
4. 备案通过后，把 **新域名** 和 **备案号截图** 发给技术（勿发 Secret/Token）。

#### 备案完成后 · 技术侧（CEO 不用动手）

| 步骤 | 谁做 | 做什么 |
|------|------|--------|
| 1 | 技术 | 新域名 DNS 解析 → `159.65.86.24`（或经 Cloudflare，与现站一致） |
| 2 | 技术 | nginx 增加 `https://新域名/wecom/callback` 反代到 `127.0.0.1:8791` |
| 3 | 技术 | 生产 `.env` 更新 `WECOM_PUBLIC_BASE_URL`（若需要） |
| 4 | CEO | 企微管理后台 → 接收消息 → URL 改为 `https://新域名/wecom/callback`（Token/AESKey **不变**） |
| 5 | 一起 | 群里 @AsiaPower 库存 Agent 发 `/ping` 验证 |

**路径 B 并行方案**：若客服在备案完成前已放行 `asia-power.com`，可跳过购域名，直接保存现有 URL 即可。

---

### 10.9 CEO 购域名逐步操作（2026-07-01 · 域名可用性已查）

> **CEO 已选路径**：购买 **公司名下** 新域名 → 企业备案 → 技术配置回调。  
> **不能代 CEO 付款** — 以下仅为逐步点击指引；购完后把域名 + 注册商截图发给技术（**勿发 Secret/Token**）。

#### 10.9.1 域名可用性（WHOIS · 2026-07-01 · CEO 改选 asia-power.*）

| 域名 | 状态 | 建议 |
|------|------|------|
| **`asia-power.cn`** | ✅ **可注册** | ⭐ **主域名** — 企微回调 URL 用这个 |
| **`asia-power.com.cn`** | ✅ **可注册** | 可选 — 品牌保护，不必单独备案 |
| `asiapower.cn` | ❌ 已被注册（无连字符） | 跳过 |
| `asiapower.com.cn` | ❌ 已被注册（无连字符） | 跳过 |
| `ppinfo.cn` | ✅ 可注册 | 旧方案备选 |
| `nypengpeng.cn` | ✅ 可注册 | 旧方案备选 |

> **带连字符 vs 无连字符**：`asia-power.cn` 与 `asiapower.cn` 是**不同域名**。无连字符版已被他人注册；带连字符版 CNNIC 查询 **No matching record**，可买。

**CEO 购买建议**：

1. **必买** **`asia-power.cn`** — 主域名，做企业备案 + 企微回调  
2. **建议加买** **`asia-power.com.cn`** — 防抢注，只注册不解析也行（回调一个域名就够）  
3. 两个域名 **持有者都填** **南阳芃芃信息科技有限公司**

#### 10.9.2 平台推荐：CEO 已选 **腾讯云**（一家搞定）

| 对比 | 腾讯云 ⭐ **CEO 选用** | 阿里云（备选） |
|------|------------------------|--------------|
| 域名 + 备案 | ✅ 同一账号、同一控制台 | ✅ 也可以 |
| 域名入口 | [dnspod.cloud.tencent.com](https://dnspod.cloud.tencent.com/) | [wanwang.aliyun.com](https://wanwang.aliyun.com/) |
| 备案入口 | [icp.cloud.tencent.com](https://icp.cloud.tencent.com/) | [beian.aliyun.com](https://beian.aliyun.com/) |
| 服务器 | **轻量 Lighthouse**（活动页 ¥99/年 2核2G） | 轻量 ECS（约 ¥99/年） |
| 组合购 | ✅ 域名+服务器组合，域名可能低至 ¥1 | 较少 |
| **结论** | **推荐 CEO 只用腾讯云** | 若已有阿里云企业账号可二选一，**不要两家混用** |

> **意思**：域名在哪买，备案就在哪做；混平台要多传材料、多等审核。  
> **CEO 逐步操作 HTML**：`docs/wecom-tencent-buy-checklist.html`（2026-07-01 新增）

**腾讯云入口**：

- 购域名：[https://dnspod.cloud.tencent.com/](https://dnspod.cloud.tencent.com/)
- 轻量服务器活动：[https://cloud.tencent.com/act/pro/lighthouse](https://cloud.tencent.com/act/pro/lighthouse)（⚠️ **不是** OpenClaw 活动页）
- 备案：[https://icp.cloud.tencent.com/](https://icp.cloud.tencent.com/)

#### 10.9.3 费用预估（腾讯云 · 2026-07-01）

| 项目 | 价格 | 说明 |
|------|------|------|
| `.cn` 注册（如 `asia-power.cn`） | **¥8.8～33/首年** | 新用户 ¥8.8；常规优惠价 ¥29～33（原价 ¥39） |
| `.com.cn` 注册（如 `asia-power.com.cn`） | **¥8.8～33/首年** | 与 `.cn` 同价档；续费约 ¥38/年 |
| `.cn` / `.com.cn` 续费 | 约 **¥38/年** | 第二年起 |
| 轻量 Lighthouse 2核2G | **¥99/年**（活动） | 入门型（基础）4M 带宽；官网原价 ¥459/年勿按原价买 |
| 组合购（域名+服务器） | 域名可能 **¥1** + 服务器 | 见 Lighthouse 活动页「组合购专区」，以结算页为准 |
| **企业 ICP 备案** | **¥0** | 接入商不收费；**只备主域名 asia-power.cn 即可** |
| **合计（1 域名 + 1年 Lighthouse）** | **约 ¥108～132** | 备案 2～4 周无额外官费 |
| **合计（2 域名 + 1年 Lighthouse）** | **约 ¥116～165** | 第二个域名仅保护，不必备案 |

#### 10.9.4 购域名 · 逐步点击（腾讯云 · CEO 选用）

**准备**：营业执照照片/扫描件、统一社会信用代码（18 位，在执照右上角）。

1. 打开 [腾讯云](https://cloud.tencent.com/) → 注册/登录 → **账号中心 → 实名认证 → 企业认证**（名称 = **南阳芃芃信息科技有限公司**）。
2. 打开 [DNSPod 域名注册](https://dnspod.cloud.tencent.com/) → 搜索 **`asia-power.cn`**（可选加购 **`asia-power.com.cn`**）→ 加入购物车 → 结算（时长建议 1～3 年）。
3. 付款后 → **域名控制台** → 信息模板：
   - **持有者类型**：企业  
   - **持有者名称**：**南阳芃芃信息科技有限公司**（与执照 **完全一致**）  
   - **统一社会信用代码**：从营业执照复制（18 位）  
4. 提交 **域名实名认证（企业）** → 上传 **营业执照** → 等待 **1～3 个工作日**。
5. 实名通过后 → 域名详情 → **下载域名证书**（PDF）→ 备案时要上传。
6. 同账号购买 **轻量 Lighthouse**（见 §10.11）— 中国大陆地域，≥3 个月，建议 1 年活动价。
7. **不要**把 DNS 改乱；备案通过前可保持默认。技术稍后会把解析指到服务器 IP。

> ⚠️ **常见错误**：持有者填个人姓名 → 企业备案会被拒。必须填 **公司全称**。  
> **阿里云逐步路径**（备选）：见下方原 §10.9.4 阿里云段落，或 `docs/wecom-buy-domain-checklist.html`。

<details>
<summary>备选 · 阿里云购域名步骤（点击展开）</summary>

1. 浏览器打开 [万网 · 域名注册](https://wanwang.aliyun.com/) → 搜索 **`ppinfo.cn`** → 加入清单 → **立即结算**。
2. 注册/登录阿里云账号 → **实名认证选「企业」**。
3. 结算页 **购买时长** 建议 **1～3 年** → 付款。
4. 付款后 → **域名控制台** → 信息模板 / 过户（持有者 = **南阳芃芃信息科技有限公司**）。
5. 提交 **域名实名认证（企业）** → 上传 **营业执照** → 等待 **1～3 个工作日**。
6. 实名通过后 → **下载域名证书**（PDF）。

</details>

#### 10.9.5 购域名后 · 备案入口（腾讯云 · CEO 选用）

实名认证 **通过后**（域名状态「正常」），建议再等 **3 天** 再提交备案（腾讯云页面会提示）：

1. 登录 [腾讯云 ICP 备案](https://icp.cloud.tencent.com/)
2. 点 **「开始备案」** 或 **「首次备案」**
3. 按向导填写（不懂就点页内 **「备案助手」**）：

| 步骤 | 填什么 |
|------|--------|
| 主体信息 | 类型 **企业**；名称 **南阳芃芃信息科技有限公司**；信用代码同执照 |
| 法人 / 联系人 | 法人身份证正反面；手机收验证码 |
| 网站信息 | 网站名称可填 **AsiaPower** 或 **南阳芃芃** |
| 接入信息 | 选同账号已购 **Lighthouse 轻量服务器**（中国大陆地域） |
| 上传材料 | 营业执照 + 域名证书 PDF |
| 法人核验 | 部分省份需 **法人手机刷脸**（按短信/小程序提示） |

4. 腾讯云初审（约 1～2 工作日）→ 短信「工信部备案核验」→ **管局审核 7～20 工作日**。
5. 备案通过后，登录 [beian.miit.gov.cn](https://beian.miit.gov.cn) 能查到 **主体 = 南阳芃芃信息科技有限公司** → 截图发给技术。

<details>
<summary>备选 · 阿里云备案入口（点击展开）</summary>

1. 登录 [阿里云备案控制台](https://beian.aliyun.com/)
2. 点 **「开始备案」** 或 **「首次备案」**
3. 网站信息选「境外托管」或「不接入云产品」（服务器在 DigitalOcean）
4. 管局审核 7～20 工作日

</details>

#### 10.9.6 购完后发给技术什么

| 发给技术 | 不要发 |
|----------|--------|
| 买到的 **域名**（主域名 `asia-power.cn`；若买了保护域名一并告知） | Secret、Token、EncodingAESKey |
| 腾讯云 **域名控制台截图**（持有者 = 公司） | 法人身份证原件高清 |
| **Lighthouse 公网 IP** | 腾讯云账号密码 |
| **备案通过后** 的 ICP 备案号截图 | |

#### 10.9.7 时间线（CEO 心里有数）

| 阶段 | 时间 |
|------|------|
| 今天购域名 + 提交企业实名 | 30 分钟操作 |
| 域名实名审核 | 1～3 天 |
| 提交备案 + 管局审核 | 7～20 工作日 |
| **技术配置 DNS + nginx + 企微后台改 URL** | 备案通过后 **1 天内**（CEO 不用动手） |
| **合计可用** | **约 2～4 周** |

**并行**：今天仍可联系企微客服走路径 B（§10.4）；若客服先放行 `asia-power.com`，可不等新域名。

---

### 10.10 国内服务器要不要买？（CEO · 2026-07-01）

> **结论（2026-07-01 更新）**：CEO 已选 **腾讯云**，域名改买 **`asia-power.cn`**（主）+ 可选 **`asia-power.com.cn`**（保护）。同账号买 **Lighthouse 轻量** 做备案接入；回调部署在国内 Lighthouse 或继续指境外（见 §10.10.3 方案 A/B）。官网 asia-power.com 继续留 DigitalOcean，**不用整站迁移**。

#### 10.10.1 现状（已核实）

| 项目 | 情况 |
|------|------|
| **有没有国内服务器** | ❌ **没有** — 代码库/部署配置里无任何阿里云/腾讯云/华为云 ECS |
| **现网唯一服务器** | `159.65.86.24` · hostname `openclaw-gh-01` |
| **云厂商 / 位置** | **DigitalOcean** · 英国伦敦（`AS14061 DigitalOcean, LLC`） |
| **跑什么** | 官网 `asia-power.com` + 库存站 + **企微回调** `:8791` |
| **企微回调资源** | 极轻 — Python 进程约 **60MB 内存**，1 核 1G 足够 |

#### 10.10.2 备案 vs 服务器位置（CEO 只需懂这句）

| 概念 | 意思 |
|------|------|
| **ICP 备案** | 在工信部登记「这个域名归哪家公司」— 企业微信靠这个校验 |
| **备案接入** | 备案时云厂商要登记「网站托管在哪」— 腾讯云买 **Lighthouse 轻量** 选「接入」最顺 |
| **备案通过后 DNS** | 域名解析可以指 **国内** 或 **境外** — 企微只查备案主体，不强制服务器在国内 |

> 腾讯云备案要求 Lighthouse **中国大陆地域**、包年包月 **≥3 个月**。买 **1 年活动价 ¥99** 最省事。备案通过后 DNS 可指国内 Lighthouse 或境外 DO（企微只查备案主体）。

#### 10.10.3 三种架构（推荐 A · 腾讯云 Lighthouse）

| 方案 | 做什么 | 优点 | 缺点 | 推荐 |
|------|--------|------|------|------|
| **A · 国内 Lighthouse 做回调** | 买腾讯云 Lighthouse；`asia-power.cn` DNS → 国内 IP；只跑 nginx + 企微回调 | 备案接入顺；回调在国内、延迟低；官网不动 | 多一台机要维护（很轻） | ⭐⭐⭐ **首选** |
| **B · 只备案、DNS 仍指境外** | 备案选 Lighthouse 接入；通过后 `asia-power.cn` → `159.65.86.24` | 国内机可最小规格 | 部分审核员可能要求网站在国内机有内容 | ⭐⭐ 备选 |
| **C · 整站迁国内** | 官网也搬回国 | 国内访问快 | 贵、工作量大、**完全没必要** | ❌ 过度 |

#### 10.10.4 方案 A 费用与部署内容（腾讯云 · CEO 选用）

| 项目 | 费用（约） | 谁买 |
|------|-----------|------|
| `asia-power.cn` 域名 | **¥8.8～33/首年** | CEO（腾讯云 DNSPod） |
| `asia-power.com.cn`（可选） | **¥8.8～33/首年** | CEO（品牌保护，不必备案） |
| Lighthouse 轻量（2核2G） | **¥99/年**（活动价） | CEO（与域名同账号） |
| 企业 ICP 备案 | **¥0** | CEO 提交 |
| **首年合计** | **约 ¥108～132**（1 域名）或 **¥116～165**（2 域名） | — |

**国内 Lighthouse 上只部署这些（技术做，CEO 不用管）**：

| 组件 | 说明 |
|------|------|
| Ubuntu + nginx | HTTPS 终止（Let's Encrypt 或腾讯云免费 SSL） |
| `wecom-callback` systemd | 同 `deploy/install-wecom-callback.sh`，监听 `127.0.0.1:8791` |
| DNS | `asia-power.cn` A 记录 → Lighthouse 公网 IP |
| 企微后台 | 可信 IP 加 **国内 IP**；回调 URL 改为 `https://asia-power.cn/wecom/callback` |

**继续留在 DigitalOcean 的**：`asia-power.com` 官网、库存 API、QXB 上传、全部业务数据 — **不动**。

#### 10.10.5 CEO 购买 Lighthouse 时注意（腾讯云）

1. **与域名同一腾讯云企业账号** — 备案时可直接选「已购 Lighthouse 接入」。
2. 活动页：[cloud.tencent.com/act/pro/lighthouse](https://cloud.tencent.com/act/pro/lighthouse)（⚠️ **不是** OpenClaw 页）。
3. 规格：**2核2G** 入门型（基础）即可（企微回调 + nginx 绰绰有余）。
4. 地域：**上海 / 广州 / 北京** 等中国大陆（香港/境外 **不能** 备案）。
5. 时长：**≥3 个月**（建议 **1 年** 拿 ¥99 活动价）。
6. 买完把 **Lighthouse 公网 IP** 发给技术（勿发 root 密码明文到群）。

<details>
<summary>备选 · 阿里云 ECS 购买注意（点击展开）</summary>

1. 与域名同一阿里云企业账号
2. 规格：1 核 1G / 40G 系统盘
3. 地域：华北/华东任意
4. 约 ¥99～120/年

</details>

#### 10.10.6 腾讯云 OpenClaw 活动页要不要买？（2026-07-01）

> **结论**：**不要**为企微备案/子敬回调去买 [cloud.tencent.com/act/pro/openclaw](https://cloud.tencent.com/act/pro/openclaw)。  
> **要买的是**：域名（[dnspod.cloud.tencent.com](https://dnspod.cloud.tencent.com/)）+ 轻量 Lighthouse（[cloud.tencent.com/act/pro/lighthouse](https://cloud.tencent.com/act/pro/lighthouse)）— 见 `docs/wecom-tencent-buy-checklist.html`。

| 对比项 | 腾讯云 OpenClaw 活动页 ❌ | AsiaPower 需要的 ✅ |
|--------|------------------------|-------------------|
| **页面卖什么** | Lighthouse + **OpenClaw 小龙虾 AI 助理** 一键部署 | **公司域名企业备案** + 跑我们自建的 **子敬库存 Agent 回调** |
| **企微接入** | OpenClaw 通用 AI 助手 | 已有代码 `wecom_callback_server.py`，不需 OpenClaw |
| **正确入口** | — | 域名：DNSPod · 服务器：Lighthouse 活动页 · 备案：icp.cloud.tencent.com |
| **规格** | 活动主推 4核4G（偏 AI 算力） | **2核2G ¥99/年** 就够（回调约 60MB 内存） |

| 若 CEO 看到活动页 | 建议 |
|-------------------|------|
| 想解决企微回调校验 | ✅ 买 **asia-power.cn + Lighthouse ¥99**（用 Lighthouse 活动页，**不是** OpenClaw 页） |
| 想个人玩 OpenClaw AI | ⚠️ 可选，但与公司业务 **无关**，另开个人账号即可 |

---

### 10.11 CEO 腾讯云 8 步购买流程（2026-07-01）

> **HTML 逐步清单**：`docs/wecom-tencent-buy-checklist.html`（CEO 可浏览器打开逐步勾选）

| 步骤 | 做什么 | 入口 |
|------|--------|------|
| 1 | 注册腾讯云 + **企业实名**（南阳芃芃信息科技有限公司） | [cloud.tencent.com](https://cloud.tencent.com/) |
| 2 | 买域名 **asia-power.cn**（+ 可选 **asia-power.com.cn**） | [dnspod.cloud.tencent.com](https://dnspod.cloud.tencent.com/) |
| 3 | 域名持有者填 **公司全称** + 提交企业实名 | 域名控制台 |
| 4 | 同账号买 **Lighthouse 2核2G**（中国大陆 · 1年） | [Lighthouse 活动页](https://cloud.tencent.com/act/pro/lighthouse) |
| 5 | 等域名实名通过 → 下载 **域名证书 PDF** | 域名控制台 |
| 6 | 提交 **企业 ICP 备案**（接入 Lighthouse） | [icp.cloud.tencent.com](https://icp.cloud.tencent.com/) |
| 7 | 等管局审核（7～20 工作日） | — |
| 8 | 备案通过后发 **域名 + 备案号截图 + Lighthouse IP** 给技术 | — |

**购完后发给技术**：域名、腾讯云域名控制台截图（持有者=公司）、备案号截图、Lighthouse 公网 IP。**勿发** Secret / Token / 密码。

---

## 11. 相关文件

| 路径 | 用途 |
|------|------|
| `integrations/wecom_callback_server.py` | HTTP 回调入口 |
| `integrations/wecom_zijing_handler.py` | 子敬路由与回复 |
| `integrations/wecom_client.py` | 发消息 / token |
| `profiles/apsales.yaml` | 子敬角色定义 |
| `agents/agent_registry.py` | 子敬 = `apsales` |
| `deploy/wecom-callback.service` | 生产 systemd 模板 |
| `deploy/install-wecom-callback.sh` | 生产安装/重启脚本 |
| `deploy/nginx-asia-power.com` | 含 `/wecom/callback` 反代 |
| `data/knowledge-base/wecom-zijing-setup-runbook.md` §10 | 域名主体校验 / 路径 B 客服话术 |
| `data/knowledge-base/wecom-zijing-setup-runbook.md` §10.8 | CEO 购域名 + 企业备案清单 |
| `data/knowledge-base/wecom-zijing-setup-runbook.md` §10.9 | CEO 购域名逐步操作（腾讯云 · CEO 选用） |
| `data/knowledge-base/wecom-zijing-setup-runbook.md` §10.10 | 国内服务器要不要买（架构 / 费用） |
| `data/knowledge-base/wecom-zijing-setup-runbook.md` §10.11 | CEO 腾讯云 8 步购买流程 |
| `docs/wecom-tencent-buy-checklist.html` | CEO 腾讯云购域名 + Lighthouse + 备案 HTML 清单 ⭐ |
| `docs/wecom-buy-domain-checklist.html` | CEO 阿里云购域名 + 备案 HTML 清单（备选） |
