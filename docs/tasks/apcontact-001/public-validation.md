# APCONTACT-001 — Public Validation (2026-07-13 incident)

**验收口径：公网 URL，不是服务器本地文件。**  
**白名单：未解除。陌生客户未对 +86 开放。**

## 结论

| 项 | 状态 |
|----|------|
| 正式营销首页 | **公网 PASS**（title = AsiaPower Global Powertrain…，非 MVP） |
| 页面默认 WhatsApp | **PASS → `https://wa.me/8616638801930`**（静态 + 浮动所用 config） |
| 裸 `js/config.js` / 裸 `sw.js` | **仍被 Cloudflare 毒缓存**（见下）— 需 CEO 在 CF 控制台 Purge |

## 每个公网页面解析出的 WhatsApp

| 公网 URL | 静态 HTML `wa.me` | 浮动按钮（由 `config.js?v=…`） | HAS +233 |
|----------|-------------------|-------------------------------|----------|
| https://asia-power.com/ | `https://wa.me/8616638801930` | `https://wa.me/8616638801930`（config `apcontact-002`） | 否 |
| https://asia-power.com/contact.html | `https://wa.me/8616638801930` | `https://wa.me/8616638801930` | 否 |
| https://asia-power.com/engines/index.html | `https://wa.me/8616638801930` | `https://wa.me/8616638801930` | 否 |
| https://asia-power.com/gearboxes/index.html | （无静态链；仅浮钮） | `https://wa.me/8616638801930` | 否 |
| https://asia-power.com/half-cuts/index.html | `https://wa.me/8616638801930` | `https://wa.me/8616638801930` | 否 |
| https://asia-power.com/supplier-portal.html | （无静态链；仅浮钮） | `https://wa.me/8616638801930` | 否 |
| https://asia-power.com/js/config.js?v=apcontact-002 | 字段 `whatsapp: '8616638801930'` | — | 否 |
| https://asia-power.com/truck-heads/ | `https://wa.me/8616638801930` | — | 否 |
| https://asia-power.com/campaigns/ghana-tiktok/ | `https://wa.me/8616638801930` | — | 否 |
| https://asia-power.com/campaigns/truck-export/ | `https://wa.me/8616638801930` | — | 否 |

### 仍异常（已知 Cloudflare 毒缓存，页面已绕过）

| 公网 URL | 解析结果 | cf-cache-status |
|----------|----------|-----------------|
| https://asia-power.com/js/config.js | `whatsapp: '233540911111'` | HIT + immutable（7/3 旧体） |
| https://asia-power.com/sw.js | `CACHE_VERSION = 'apapp-001-v4'` | HIT + immutable |
| https://asia-power.com/sw.js?v=apcontact-002 | `CACHE_VERSION = 'apcontact-002-v1'` | MISS/正确 |

首页已改为加载 `config.js?v=apcontact-002` 与 `register('/sw.js?v=apcontact-002')`，**正常访问主站不会再读裸毒路径**。

## 首页内容核对

- Title：`AsiaPower | Global Powertrain Sourcing for Cars, Trucks, Motorcycles & Machinery`
- Body class：`page-home-v4-hybrid`
- **不是**「Asia-Power Auto Parts / 库存 / 供应商上传 MVP」
- 若本机仍见旧 UI：硬刷新 + 清除站点数据 / 注销旧 Service Worker

## Release / Commit

| 项 | 值 |
|----|-----|
| Commits | `d40316224`, `eb953e2b9` |
| API Release | `REL-20260713105355-api-d40316224`（短缓存头） |
| Home/Chrome | rsync 已落地；脚本 SSH 校验曾 exit 1（文件已同步） |
| Origin Cache-Control for config.js | `public, max-age=60, must-revalidate` |

## CEO 必须手动做（API token 无 Cache Purge）

Cloudflare → asia-power.com → Caching → **Configuration → Purge Cache**：

1. 至少 Purge：`/js/config.js`、`/sw.js`、`/js/components.js`  
2. 或 **Purge Everything**

否则裸 URL 仍会显示 +233（不影响已带 `?v=apcontact-002` 的主路径）。
