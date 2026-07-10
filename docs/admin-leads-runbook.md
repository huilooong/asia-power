# Admin Lead Inbox — CEO Runbook

## 一句话

**客户询价看 `admin/leads.html`（Lead Inbox / 询价收件箱），不是 `admin/inventory.html`（库存审核）。**

## 在哪里看

| 页面 | 地址 | 用途 |
|------|------|------|
| **Lead Inbox · 询价收件箱** | https://asia-power.com/admin/leads.html | 网站表单、WhatsApp 快捷询价、Half-cut 客户询价 |
| Inventory Hub | https://asia-power.com/admin/inventory.html | 供应商上传库存、待审/已上架 — **不含客户询价** |
| Analytics | https://asia-power.com/admin/analytics.html | 流量与审核统计 |

## 通知从哪来

- **Telegram**（@sursor_bot）：新询价、WhatsApp 点击等
- **企业微信工作台**：目前 **没有** 接 Lead Inbox，不要在这里找询价

## 筛选怎么用

| 标签 | 显示什么 |
|------|----------|
| **Open** | 待跟进（默认，推荐先看） |
| **Website** | 网站表单 + WhatsApp 快捷询价（含 `whatsapp-intent`） |
| **WhatsApp** | 仅 WhatsApp 快捷询价 |
| **Half-cut / Catalog** | 半切 / 产品目录类询价 |
| **All** | 全部 |

**常见误区**：WhatsApp 快捷询价 **不会** 出现在 Half-cut / Catalog 里；若 Open 里能看到、Website 里看不到，请强刷页面（Ctrl+F5）。

## 顶部数字

在 Inventory / Analytics 页导航上的 **「Lead Inbox · 询价 (N)」** = 待跟进条数（`replyStatus !== replied`）。

## 健康检查（技术）

```bash
curl -s https://asia-power.com/api/leads/health
# 期望: {"ok":true,"total":...,"open":...,"inboxPage":"/admin/leads.html"}
```

部署前本地：

```bash
bash scripts/check-admin-js.sh
```

## 故障排查

1. 页面空白 → 浏览器 F12 Console 是否有 JS 错误；运行 `bash scripts/check-admin-js.sh`
2. Telegram 有通知但网页没有 → 确认打开 **leads.html** 且登录 Admin；点 **Open** 或 **All**
3. 强刷仍不行 → `curl -s https://asia-power.com/api/leads/health` 看 `open` 是否 > 0
