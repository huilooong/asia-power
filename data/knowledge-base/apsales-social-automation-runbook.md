# 子敬 · 社媒全自动 Runbook（FB / IG / X）

> **CEO 承诺**：子敬/CEO **登录一次** → 之后发帖、扫描回复、更新看板 **100% 自动**（回复发送仍须 CEO 批准）。  
> KPI：进站 `https://asia-power.com/half-cuts/` · 邮件 `sales@asia-power.com`

---

## 结论（30 秒）

| 阶段 | 谁干活 |
|------|--------|
| **一次性（~30 分钟）** | CEO 开 Meta Business + Page + X 账号；**子敬** 各平台运行登录脚本 **一次** |
| **之后** | **Autopilot 脚本 + cron** 自动发帖、扫回复、Telegram 通知 CEO；**回复发送** CEO 批准 |

**推荐**：生产环境优先 **Meta Graph API + X API**（更稳）；浏览器 Playwright 作备用（Meta 可能拦截 headless）。

### CEO 三条路径（Mac 一键）

| 路径 | 做什么 | 谁操作 | 一键入口 |
|------|--------|--------|----------|
| **A 推荐** | Meta Graph API → FB + IG 自动发帖 | CEO 开 Business/Page；子敬填 Token | 双击 `docs/子敬-社媒登录-一键操作.command` → 选 **A** |
| **B 备用** | Playwright 浏览器登录 Cookie | 子敬本地 Mac（有屏幕） | 同上 → 选 **B** |
| **C** | X 付费 API Bearer Token | CEO 买 Basic 档；子敬填 Token | 同上 → 选 **C** |

> **诚实**：Cursor / AI **没有** Facebook 官方插件；Instagram **必须**走路径 A 才能自动发图；浏览器 MCP 不能替 CEO 完成 2FA 登录。

---

## 架构

```
CEO 批准方案 A–E 内容
        ↓
apsales_distribution_progress.json / social_posts_registry.json
  status: approved_pending_publish
        ↓
cron: apsales-social-autopilot.py --all  （每 15 分钟）
        ├─ API 优先（.env 有 token）
        ├─ 否则 Playwright 浏览器会话
        ├─ 成功 → post_url 写回看板 + Telegram
        └─ 扫评论 → social_reply_inbox.json
        ↓
cron: apsales-social-reply-watch.py  （每小时）
        └─ 跟进草稿 → draft_queue → CEO Telegram 批准
```

---

## 方案 A：官方 API（推荐 · 生产）

### 子敬/CEO 一次性设置（Meta · ~20 分钟）

1. 打开 [Meta Business Suite](https://business.facebook.com/) → 创建 **Business Manager**
2. 创建 **Facebook Page**（AsiaPower 品牌）
3. **Instagram** → 转 **Professional/Business** → 绑定到 FB Page
4. [developers.facebook.com](https://developers.facebook.com/) → 创建 App → 添加 **Facebook Login** + **Pages API**
5. 生成 **Page Access Token**（长期）→ 写入生产 `.env`：
   ```bash
   META_PAGE_ID=你的Page数字ID
   META_PAGE_ACCESS_TOKEN=EAAxxxxx
   META_IG_USER_ID=Instagram商业账号ID
   META_GRAPH_API_BASE=https://graph.facebook.com/v21.0
   ```
6. App 权限需：`pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`

### X (Twitter) API（~10 分钟）

1. [developer.x.com](https://developer.x.com/) → 创建 Project/App
2. 需 **Basic 或更高付费档** 才能稳定发推（免费档常受限）
3. 写入 `.env`：
   ```bash
   X_API_BEARER_TOKEN=AAAAAAAA...
   X_API_BASE=https://api.twitter.com/2
   ```

### 验证 API

```bash
cd /root/.openclaw/workspace/AsiaPower
.venv/bin/python3 -c "
from customer_gateway.social_session import session_status
for p in ('facebook','instagram','x'):
    print(p, session_status(p))
"
```

API token 配置好后，看板显示 **✅ 已登录（api）**，无需浏览器登录。

---

## 方案 B：Playwright 浏览器（备用）

> Meta 常检测自动化浏览器；**无图形界面服务器**上可能失败。建议 **子敬本地 Mac 登录 → 上传 session 到生产**。

### 子敬本地登录（有屏幕的电脑）

```bash
cd /path/to/AsiaPower
APSALES_SOCIAL_BROWSER_HEADLESS=0 python3 scripts/apsales-social-login.py --platform facebook
APSALES_SOCIAL_BROWSER_HEADLESS=0 python3 scripts/apsales-social-login.py --platform instagram
APSALES_SOCIAL_BROWSER_HEADLESS=0 python3 scripts/apsales-social-login.py --platform x
```

每个平台：浏览器弹出 → 公司账号登录（含 2FA）→ 终端按 Enter → 会话保存到  
`memory/customer_gateway/social_sessions/{platform}/`

### 上传到生产

```bash
# 打包
python3 scripts/apsales-social-login.py --platform facebook --export /tmp/fb-session.tar.gz

# 上传
scp /tmp/fb-session.tar.gz root@159.65.86.24:/tmp/

# 生产解压
ssh root@159.65.86.24 'cd /root/.openclaw/workspace/AsiaPower/memory/customer_gateway/social_sessions && tar xzf /tmp/fb-session.tar.gz && chmod -R 700 facebook'
```

验证：

```bash
ssh root@159.65.86.24 'cd /root/.openclaw/workspace/AsiaPower && .venv/bin/python3 scripts/apsales-social-login.py --status'
```

---

## CEO 审批门（自动化后）

| 动作 | 是否自动 | 说明 |
|------|----------|------|
| **发帖（方案 A–E）** | ✅ 自动 | CEO 已批过的批次 → `approved_pending_publish` → Autopilot 发 |
| **新帖文案** | ❌ 须 CEO 批 | 新内容先入审批包，批后改 status |
| **回复客户** | ❌ 须 CEO 批 | 脚本起草 → `/drafts approve` 或 Telegram「同意」→ **仍建议人工点 Send**（或未来开 AUTO_REPLY 护栏） |
| **邮件 outreach** | ❌ 须 CEO 批 | 现有 Resend 流程不变 |

---

## 子敬 30 分钟一次性清单

- [ ] CEO：Meta Business Manager + FB Page + IG Business 绑定
- [ ] CEO：注册 X 公司号 + 2FA
- [ ] （推荐）CEO/子敬：配置 `.env` API tokens
- [ ] 或：子敬本地 `--platform facebook|instagram|x` 登录三次
- [ ] 上传 session 到生产（若本地登录）
- [ ] 生产运行：`python3 scripts/apsales-social-autopilot.py --status` → 三平台 ✅
- [ ] 启用 cron（见下）
- [ ] 看板确认：https://asia-power.com/admin/apsales-progress.html

---

## 登录后 CEO/运维执行的命令

```bash
cd /root/.openclaw/workspace/AsiaPower

# 1. 检查三平台会话 + 待发队列
.venv/bin/python3 scripts/apsales-social-autopilot.py --status

# 2. 立即跑一轮（发帖 + 扫回复 + 起草跟进）
.venv/bin/python3 scripts/apsales-social-autopilot.py --all

# 3. 仅发帖
.venv/bin/python3 scripts/apsales-social-autopilot.py --publish
```

---

## 生产 Cron

文件：`deploy/cron/apsales-social-autopilot.cron`

```bash
# 每 15 分钟：自动发帖 + 扫回复
*/15 * * * * root cd /root/.openclaw/workspace/AsiaPower && APSALES_SOCIAL_AUTOPILOT=1 .venv/bin/python3 scripts/apsales-social-autopilot.py --all >> /var/log/apsales-social-autopilot.log 2>&1

# 每小时：回复提醒 + 自动起草（已有）
0 * * * * root cd /root/.openclaw/workspace/AsiaPower && APSALES_SOCIAL_REPLY_WATCH=1 .venv/bin/python3 scripts/apsales-social-reply-watch.py >> /var/log/apsales-social-reply-watch.log 2>&1
```

安装：

```bash
sudo cp deploy/cron/apsales-social-autopilot.cron /etc/cron.d/apsales-social-autopilot
sudo chmod 644 /etc/cron.d/apsales-social-autopilot
```

---

## Mac 本地 · Facebook 每日一体运行

> **CEO 要求**：好友几乎都是拆车/半切从业者 — 不发帖时也要刷动态、记笔记。  
> **只在 Mac 跑**（FB 已本地登录 gooddlong）；生产服务器无浏览器会话。  
> **一个浏览器、一次跑完** — 子敬自动管锁，**CEO 无需手动关 Chrome**。

| 项 | 说明 |
|----|------|
| **脚本** | `scripts/apsales-facebook-daily-run.py --all` |
| **一步完成** | 通过好友请求 → 刷 50 帖动态 → 发最多 5 条私信 → 队列有则发 1 条时间线帖 |
| **会话管理** | `integrations/social_browser/session_manager.py` · 文件锁 `.browser.lock` |
| **笔记** | `memory/customer_gateway/fb_friends_market_intel.jsonl` |
| **策略** | `config/apsales_social_engagement_policy.yaml` |

### Mac 定时（二选一 · 只装一个）

**cron（推荐）** — `deploy/cron/apsales-facebook-daily-mac.cron`：

```bash
crontab -e
# 粘贴 deploy/cron/apsales-facebook-daily-mac.cron 中的一行
```

**launchd** — 开机后由 macOS 调度：

```bash
cp deploy/launchd/com.asiapower.apsales.facebook-daily.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.asiapower.apsales.facebook-daily.plist
```

> **勿再安装** 旧的 `apsales-facebook-friend-dm-mac.cron` 或多条 browse/DM cron — 会抢同一 Chrome 配置。

### 单独步骤（调试用 · 仍走 session_manager）

| 脚本 | 用途 |
|------|------|
| `scripts/apsales-facebook-accept-friends.py` | 仅通过好友 |
| `scripts/apsales-facebook-browse-friends.py` | 仅刷动态 |
| `scripts/apsales-facebook-dm-friends.py --send` | 仅私信 |

---

## Mac 本地 · Facebook 好友动态浏览（旧 · 已合并到 daily-run）

> 仍可用 `apsales-facebook-browse-friends.py` 单独调试；**日常请用 daily-run**。

| 项 | 说明 |
|----|------|
| **脚本** | `scripts/apsales-facebook-browse-friends.py` |
| **一键** | 双击 `docs/一键运行-FB浏览好友动态.command` |
| **时段** | 已合并进 daily-run UTC 21:00 |
| **笔记** | `memory/customer_gateway/social_research_notes.jsonl` |
| **看板** | `.venv/bin/python3 scripts/apsales-zijing-watch.py --loop` 或双击 `docs/打开-子敬工作状态.command` |
| **策略** | `config/apsales_social_engagement_policy.yaml` → `browse_feed` |

### Mac cron（已废弃 · 勿用）

~~每天 21:00 和 05:00 各跑 browse-friends~~ → 改用 **daily-run 一条 cron**。

---

## 环境变量（`.env`）

```bash
# Autopilot 总开关
APSALES_SOCIAL_AUTOPILOT=1
APSALES_SOCIAL_MAX_POSTS_PER_RUN=3
APSALES_SOCIAL_BROWSER_HEADLESS=1
APSALES_SOCIAL_BROWSER_SCAN=1

# Meta Graph API（推荐）
META_PAGE_ID=
META_PAGE_ACCESS_TOKEN=
META_IG_USER_ID=

# X API v2
X_API_BEARER_TOKEN=

# Session 目录（默认 memory/customer_gateway/social_sessions）
# APSALES_SOCIAL_SESSIONS_DIR=

# 回复扫描（已有）
APSALES_SOCIAL_REPLY_WATCH=1
APSALES_SOCIAL_SCAN_HOURS=1
APSALES_SOCIAL_MAX_DRAFTS=5
```

---

## 诚实限制

| 平台 | API | 浏览器 |
|------|-----|--------|
| **Facebook Page** | ✅ 稳定 | ⚠️ 可能弹验证/封 headless |
| **Instagram** | ✅ 须 Graph API | ❌ 几乎不可用（无 API 别指望自动发图） |
| **X** | ✅ 须付费 API 档 | ⚠️ 界面常变，易 broken |
| **FB 小组帖** | ❌ API 不能代发小组 | 仍须人工或 Partner |

**建议 CEO**：Meta + IG 走 **Graph API**；X 买 **Basic API**；浏览器只作应急。

### 真人外联话术（human_v2 · 2026-07-04）

子敬 FB 好友 DM、小组问候、X 短帖、评论话术统一维护在 `config/apsales_outreach_copy.yaml`（CEO 可直接改字）。规则：**像真人聊天**——先发无链接开场白，**等 120 秒**再发带 HC250509/HC250513 实拍图的详情链接，可选第三条再等 120 秒发目录 `asia-power.com/half-cuts/`；每段对话**最多 2 个链接**。Mac 脚本：`apsales-facebook-dm-friends.py --send`（分段 DM）、`apsales-facebook-daily-run.py`（小组分段问候）。演示模式 `APSALES_SOCIAL_DEMO_MODE=1` 会把 120 秒缩到 5–10 秒方便本地试跑。

---

## 相关文件

| 文件 | 用途 |
|------|------|
| `scripts/apsales-social-login.py` | 一次性登录 |
| `scripts/apsales-social-autopilot.py` | 发帖 + 扫回复 |
| `scripts/apsales-social-reply-watch.py` |  hourly 回复草稿 |
| `customer_gateway/social_autopilot.py` | 核心逻辑 |
| `customer_gateway/social_session.py` | 会话状态 |
| `customer_gateway/social_api.py` | Meta/X API |
| `integrations/social_browser/session_manager.py` | **单浏览器锁 + 会话管理** |
| `scripts/apsales-facebook-daily-run.py` | **Mac 每日一体 FB 运行** |
| `admin/apsales-progress.html` | CEO 看板 |

---

*最后更新：2026-07-04 · 维护：子敬（APSales）*
