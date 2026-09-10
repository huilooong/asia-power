# OPS · Agent 发 Facebook：用 Graph API，不走 Google 浏览器验证

**Status:** 工程已改 · 等 CEO 用手机贴一次 Page Token  
**Date:** 2026-09-10  
**Task:** 电脑 `web.facebook.com` 强制「使用 Google 验证」→ Google `redirect_uri_mismatch`，后续 Agent 不能再走这条登录

## 结论（给 CEO）

| 项 | 说明 |
|----|------|
| 电脑 Google 验证 | **修不了**。这是 Facebook 自己的安全门 + Google 回跳地址对不上，不是 asia-power.com 代码 |
| 手机已登录 | 只说明**你**能用 App；Agent 没有手机，不能点那个蓝按钮 |
| Agent 以后怎么发帖 | 用官方接口（Graph API，意思是：拿一把钥匙发帖，不再打开浏览器登录） |
| 你要做的 | 手机上复制一串 Token 私聊发给我（或发给执行 Agent），**不要发到公开群** |

## Agent 规则（必须遵守）

1. **禁止**用 Playwright / Chrome 去过 `login_with_third_party` /「使用 Google 验证」
2. Facebook 主页发帖只走 `META_PAGE_ID` + `META_PAGE_ACCESS_TOKEN`
3. 未配置 token 时 autopilot 返回 `facebook_requires_graph_api`，不得改回浏览器硬登
4. 浏览器若落到 `web.facebook.com`，代码会改写到 `www.facebook.com`；若仍是 Google 验证页，视为未登录

## CEO 手机操作（约 5 分钟 · App 已登录）

1. 打开手机 **Facebook App**（保持登录）
2. 给自己发一条私信或发一条**仅自己可见**的帖子，内容只贴：  
   `https://developers.facebook.com/tools/explorer/`
3. **在 Facebook App 里点开这条链接**（不要拷到无痕 Chrome）
4. 右上角选应用：**AsiaPower Customer Connect**（若列表没有，选任意已有 App 也可先试）
5. User or Page → 选 **AsiaPower** 主页（不是个人号）
6. 权限勾选：`pages_show_list`、`pages_manage_posts`、`pages_read_engagement`
7. 点 **Generate Access Token** → 允许
8. 复制以 `EAA` 开头的一长串 → **私聊发给 Agent**

Page ID（已知）：`61591139770494`（AsiaPower 主页链接里的数字）

## Agent 拿到 token 后

```bash
.venv/bin/python3 scripts/apsales-meta-page-token.py --token 'EAA…' --page-id 61591139770494 --write-env
.venv/bin/python3 scripts/apsales-meta-page-token.py --verify-only
```

生产写入（不提交 git）：

```bash
node scripts/apply-oauth-credentials.mjs --file /tmp/asiapower-meta.secrets.env
```

文件内容示例（勿入库）：

```
META_PAGE_ID=61591139770494
META_PAGE_ACCESS_TOKEN=EAA…
```

验证：`python3 scripts/apsales-social-login.py --status` 中 facebook 应为 `api` 已登录。

## 代码入口

| 文件 | 作用 |
|------|------|
| `scripts/apsales-meta-page-token.py` | 校验并写入 Page token |
| `customer_gateway/social_api.py` | Graph 发帖 |
| `customer_gateway/social_autopilot.py` | 无 token 时拒绝浏览器 Facebook 发帖 |
| `integrations/social_browser/facebook_host.py` | web→www；识别 Google 验证页 |

## 验证（本轮已做）

```text
python3 -m unittest tests.test_facebook_host
```
