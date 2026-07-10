# 子敬 · 邮件转发 + 主动找客户 Runbook

> Agent：鲁肃（子敬 / `apsales`）  
> 原则：**收信 → 脱敏 → 草稿 → CEO 批准 → 才发送**（不自动外发）

---

## 一、今天已落地的代码

| 模块 | 作用 |
|------|------|
| `server/lib/email-proxy.js` | 收邮件、脱敏、存 `data/email-threads.json` |
| `POST /api/email/inbound` | Cloudflare Email Worker 回调入口 |
| `deploy/cloudflare-email-worker.js` | Cloudflare 侧转发脚本 |
| `customer_gateway/email_inbound.py` | 邮件 → 子敬草稿 |
| `customer_gateway/outreach_engine.py` | 主动找客户候选 + 草稿队列 |
| 子敬命令 | `/email …` · `/outreach …` |

---

## 二、邮件转发 — CEO 必做（约 30 分钟）

### 现状（诚实说明）

| 项 | 状态 |
|----|------|
| 对外销售邮箱（统一口径） | `sales@asia-power.com` |
| 历史收件 | `inquiry@` 仍转发，回复一律从 `sales@` 发出 |
| 网站 `config.js` 显示 | 仍是 `weylonhui@gmail.com` ⚠️ 待改 |
| 代码 `email-proxy.js` | ✅ 今日新增 |
| Cloudflare Email Worker | ⏸ 需 CEO 在 Cloudflare 部署 |

### Step 1 — 生成密钥

在服务器 `.env` 添加：

```bash
EMAIL_INBOUND_SECRET=（随机长字符串，勿泄露）
EMAIL_PROXY_DOMAIN=asia-power.com
EMAIL_REPLY_LOCAL=reply
```

### Step 2 — Cloudflare Email Routing

**一键（推荐）：** 双击 `docs/一键部署-子敬邮件转发.command` → 浏览器点「Allow」→ 自动完成。

**或手动：**

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com) → 选 `asia-power.com`
2. **Email** → **Email Routing** → 启用
3. **Destination addresses**：验证 CEO 收信邮箱（如 Gmail）
4. **Email Workers** → 创建 Worker，粘贴 `deploy/cloudflare-email-worker.js`
5. Worker 环境变量：
   - `ASIAPOWER_EMAIL_WEBHOOK` = `https://asia-power.com/api/email/inbound`
   - `ASIAPOWER_EMAIL_SECRET` = 与 `.env` 中 `EMAIL_INBOUND_SECRET` 相同
6. 路由规则：`inquiry@asia-power.com` → 该 Worker

### Step 3 — 验证

```bash
curl -s https://asia-power.com/api/email/health
# 期望: {"ok":true,"total":0,...}

# 模拟一封邮件（本地/服务器，替换 SECRET）
curl -s -X POST https://asia-power.com/api/email/inbound \
  -H "Content-Type: application/json" \
  -H "X-AsiaPower-Email-Secret: YOUR_SECRET" \
  -d '{"from":"test@buyer.com","to":"inquiry@asia-power.com","subject":"G4KJ quote","text":"Need 2 units FOB Tema"}'
```

Telegram 应收到「📧 新邮件询价（子敬）」通知。

### Step 4 — 子敬处理

```bash
.venv/bin/python3 main.py "/email list"
.venv/bin/python3 main.py "/email process em-xxxxx"
.venv/bin/python3 main.py "/drafts show draft-xxxxx"
```

---

## 三、邮件流程（脱敏）

```
客户 → inquiry@asia-power.com
         ↓ Cloudflare Worker
    POST /api/email/inbound
         ↓ email-proxy.js
    - 存 thread + 脱敏正文（隐藏电话/WhatsApp/微信/邮箱）
    - 分配 proxy 回复地址 reply+em-xxx@asia-power.com
         ↓ Telegram 通知 CEO
    .venv/bin/python3 main.py "/email process …"
         ↓ 子敬出草稿
    /drafts approve（邮件 Phase 2 可 --send 或 /email send）
```

**Phase 2（发信 · Resend）：** 对外销售统一从 `sales@asia-power.com` 发出（含客户发到 inquiry@ 的线程）。

---

## 2b、Phase 2 — 发信（Resend）

### CEO 必做（约 15 分钟）

1. 注册 [Resend](https://resend.com) → **Domains** → 添加 `asia-power.com`
2. 按 Resend 提示在 **Cloudflare DNS** 添加 SPF / DKIM 记录（通常 3–4 条 TXT/CNAME）
3. 等域名状态 **Verified**
4. **API Keys** → 创建 Key → 写入生产 **两个** `.env`（Python 读 `AsiaPower/.env`，Node 读 `inventory-site/.env`）：

```bash
RESEND_API_KEY=re_xxxxxxxx
EMAIL_SEND_ENABLED=1
# 可选
EMAIL_FROM_SALES=AsiaPower Sales <sales@asia-power.com>
# inquiry@ 历史收件，发信仍走 sales@
# EMAIL_FROM_INQUIRY=AsiaPower Sales <sales@asia-power.com>
# 批准后自动发（默认关）
# EMAIL_AUTO_SEND_ON_APPROVE=1
```

5. 重启 inventory-site Node 进程（发 API 健康检查应含 `outbound.sendEnabled: true`）

### 发送命令

```bash
.venv/bin/python3 main.py "/drafts approve draft-xxxxx --send"
# 或先 approve 再
.venv/bin/python3 main.py "/email send draft-xxxxx"
.venv/bin/python3 main.py "/email send-status"
```

Admin API（需登录）：

```bash
curl -X POST https://asia-power.com/api/email/send \
  -H "Cookie: …" \
  -H "Content-Type: application/json" \
  -d '{"threadId":"em-xxxxx","text":"…"}'
```

### 验证

```bash
curl -s https://asia-power.com/api/email/health
# 期望 outbound: { sendEnabled: true, provider: "resend", ... }
```

---

## 四、主动找客户 — 子敬怎么用

### 数据来源

1. **网站 Lead Inbox** — `data/contact-leads.json` 里 `replyStatus !== replied`
2. **WhatsApp 跟进清单** — `/customer followups` 同源画像

### 命令

```bash
.venv/bin/python3 main.py "/outreach scan"              # 看谁该联系
.venv/bin/python3 main.py "/outreach draft lead-xxxxx"    # 生成开发信草稿
.venv/bin/python3 main.py "/outreach queue"               # 看待审批队列
```

### 规则

- **不自动发送** WhatsApp / 邮件
- 草稿需 CEO 批准；WhatsApp 正式发送等 Cloud API 接入后再开
- 营销外联需注意 opt-in（未同意的不群发）

---

## 五、自动获客 / 流量任务（Cron）

**原则不变：** 只扫描、起草、汇报；**不自动**发 WhatsApp / 邮件。

### 开关（AsiaPower `.env`）

```bash
APSALES_GROWTH_AUTOPILOT=1
APSALES_GROWTH_MAX_EMAIL_DRAFTS=5
APSALES_GROWTH_MAX_OUTREACH_DRAFTS=3
INVENTORY_SITE_ROOT=/root/.openclaw/workspace/inventory-site
```

### 手动试跑

```bash
cd /root/.openclaw/workspace/AsiaPower
.venv/bin/python3 scripts/apsales-growth-autopilot.py
```

### 每轮做什么

| 步骤 | 动作 |
|------|------|
| 1 | 未处理邮件 → 子敬自动起草 + CEO 审批邮件 |
| 2 | 高优先级客户 → 最多 3 条开发信草稿 |
| 3 | 网站 PV / 国家 / WhatsApp 点击 → Telegram 汇报 + 流量建议 |

Cron：`0 9,14,19 * * *` · 日志 `/var/log/asiapower-apsales-growth.log`

---

## 六、今日目标对照

| 目标 | 今天完成度 | 下一步 |
|------|-----------|--------|
| 邮件转发机制 | 代码 ✅ / DNS+Worker ⏸ CEO | Cloudflare 部署 + 改网站邮箱 |
| 子敬自己找客户 | 扫描+草稿 ✅ / 定时自动跑 ✅ | CEO 批准草稿后发送 |

---

## 七、故障排查

| 现象 | 处理 |
|------|------|
| `/api/email/inbound` 403 | 检查 `X-AsiaPower-Email-Secret` 与 `.env` 一致 |
| `/email list` 空 | Worker 未部署或邮件未到 API |
| `/outreach scan` 空 | 无未回复 Lead；或本地无 `data/contact-leads.json` |
| Telegram 无通知 | 检查 `ASIAPOWER_TELEGRAM_*` 环境变量 |
