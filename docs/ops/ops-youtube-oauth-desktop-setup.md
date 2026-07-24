# OPS · YouTube 上传授权与自动同步

**日期：** 2026-07-16（授权）· 2026-07-24（自动队列）

## 目标流程

审核通过上架 → 媒体 promote 到 `/uploads/videos/…` → 入队 `reports/youtube-upload-queue.json` → 后台上传 YouTube → 回写 `videoUrl` + `youtubeVideoId` → 详情页播 YouTube（引流）。

**不在**供应商一点上传就推频道（拒稿不上 YouTube）。

## 授权（一次性）

**症状：** 授权页「禁止访问：此应用的请求无效」  
**根因：** 把**网页应用**密钥假包装成 Desktop，或 Web 客户端未登记本机回调地址。

### 方案 A（沿用原网站密钥 + 加 YouTube 权限）— CEO 当前路径

已做：在 OAuth 同意屏幕加 YouTube 权限 / 启用 API。

还差一步——打开该 **网页应用** OAuth 客户端，在 **已授权的重定向 URI** 里**新增**（原有网站回调不要删）：

```text
http://127.0.0.1:8765/
http://localhost:8765/
```

控制台：https://console.cloud.google.com/apis/credentials

### 方案 B（推荐长期）：另建 Desktop 客户端

1. 启用 API：https://console.cloud.google.com/apis/library/youtube.googleapis.com  
2. 创建凭证 → OAuth 客户端 ID → **桌面应用** → 下载 JSON  
3. 覆盖到：`work/youtube-inventory-migrate/client_secret.json`

### 授权命令

```bash
.venv/bin/python scripts/youtube_inventory_upload.py --auth
```

用 **AsiaPower YouTube 频道所属 Google 账号** 点允许。Token 写入：

`work/youtube-inventory-migrate/youtube-oauth-token.json`（**禁止提交 Git**）

## 生产安装（出带密钥，不进仓库）

路径（inventory-site 根）：

| 文件 | 说明 |
|------|------|
| `work/youtube-inventory-migrate/client_secret.json` | OAuth 客户端 |
| `work/youtube-inventory-migrate/youtube-oauth-token.json` | refresh token |
| `.venv-youtube/` | `google-api-python-client` 等 |
| `scripts/youtube_inventory_upload.py` | 上传 worker |
| `reports/youtube-upload-queue.json` | 持久队列 |
| `lib/youtube-upload-queue.js` | 入队 + 定时 spawn |

`.env` 建议：

```bash
YOUTUBE_PYTHON=/root/.openclaw/workspace/inventory-site/.venv-youtube/bin/python3
YOUTUBE_SYNC_ENABLED=1
YOUTUBE_UPLOAD_QUEUE_POLL_MS=120000
PUBLIC_SITE_URL=https://asia-power.com
INVENTORY_SITE_INTERNAL_URL=http://127.0.0.1:8080
```

视频文件多在 R2：worker **优先**从本机 `8080` 拉 mp4（避免外网 UA 被拦 403）。

从本机拷贝 token（示例）：

```bash
scp work/youtube-inventory-migrate/client_secret.json \
    work/youtube-inventory-migrate/youtube-oauth-token.json \
    root@159.65.86.24:/root/.openclaw/workspace/inventory-site/work/youtube-inventory-migrate/
ssh root@159.65.86.24 'chmod 600 /root/.openclaw/workspace/inventory-site/work/youtube-inventory-migrate/*'
```

## 常用命令

```bash
# 处理队列（站点进程也会每 ~2 分钟自动跑）
.venv-youtube/bin/python scripts/youtube_inventory_upload.py --process-queue --batch 1

# 单条补传
.venv-youtube/bin/python scripts/youtube_inventory_upload.py --upload-stock HC250590

# 已有 YouTube id、只回写库存 JSON
.venv-youtube/bin/python scripts/youtube_inventory_upload.py \
  --set-youtube HC250036=1VAdccf-VH8
```

## 不要做

- 不要把网站 Web Client **改类型**成 Desktop（会弄坏买家登录）
- 不要把 `client_secret.json` / token 提交到 GitHub
- 不要在供应商上传瞬间推 YouTube（必须审核通过后）
- 部署时不要用 rsync **覆盖**生产 `reports/youtube-upload-queue.json`
