# OPS · YouTube 上传授权

**日期：** 2026-07-16  
**症状：** 授权页「禁止访问：此应用的请求无效」  
**根因：** 把**网页应用**密钥假包装成 Desktop，或 Web 客户端未登记本机回调地址。

## 方案 A（沿用原网站密钥 + 加 YouTube 权限）— CEO 当前路径

已做：在 OAuth 同意屏幕加 YouTube 权限 / 启用 API。

还差一步——打开该 **网页应用** OAuth 客户端，在 **已授权的重定向 URI** 里**新增**（原有网站回调不要删）：

```text
http://127.0.0.1:8765/
http://localhost:8765/
```

保存后告诉我，再跑 `--auth`。

控制台入口：  
https://console.cloud.google.com/apis/credentials

## 方案 B（推荐长期）：另建 Desktop 客户端

1. 启用 API：https://console.cloud.google.com/apis/library/youtube.googleapis.com  
2. 创建凭证 → OAuth 客户端 ID → **桌面应用** → 下载 JSON  
3. 覆盖到：`work/youtube-inventory-migrate/client_secret.json`

## 测试用户

若同意屏幕仍是 Testing：把 `gooddlong@gmail.com` 加进测试用户。

## 授权命令

```bash
.venv/bin/python scripts/youtube_inventory_upload.py --auth
.venv/bin/python scripts/youtube_inventory_upload.py --upload-all
```

用 **AsiaPower YouTube 频道所属 Google 账号** 点允许。

## 不要做

- 不要把网站 Web Client **改类型**成 Desktop（会弄坏买家登录）
- 不要把 `client_secret.json` / token 提交到 GitHub
