# OPS-003 — Review

## 交付

| 项 | 路径 |
|----|------|
| 校验引擎 | `scripts/lib/post-release-validation.mjs` |
| CLI | `scripts/post-release-validation.mjs` |
| Release Manager 接线 | `scripts/lib/release-manager.mjs` → `runPostDeployValidation` |
| Deploy 传 Release ID | `scripts/deploy-production.mjs` |
| config stamp 字段 | `js/config.js` → `releaseId` |
| 报告目录 | `docs/tasks/ops-003/` |

## 第一次干跑（公网）

```
status=fail  pass=52  fail=5
```

自动发现（正是 APCONTACT 类问题）：

1. 裸 `config.js` WhatsApp = `233540911111`  
2. 裸 `config.js` 含禁用旧号  
3. `config.js` Cache-Control = 一年 immutable  
4. 裸 `sw.js` 仍预缓存 `/js/config.js`  
5. `sw.js` Cache-Control = 一年 immutable  

Cloudflare purge：**Manual Action Required**（当前 Token 无 Cache Purge）

## CEO 四问

### 1. 以后每次 Release 都会自动验证公网吗？

**会。** 目标为 `nginx|api|engines|home|chrome|portal|categories|admin` 时，Release Manager 在部署后自动跑 OPS-003 解析校验；失败则 **Release FAIL**（exit 1）。

### 2. 能否自动发现旧 WhatsApp / 旧 config / 旧 sw / 旧 title / 旧 canonical？

**能。** 不是只查 HTTP 200，会解析：

- 最终 HTML title / canonical / wa.me  
- 页面实际加载的 `config.js?v=…` 内 `whatsapp`  
- 裸 `config.js` / 裸 `sw.js`（专门抓 CF 毒缓存）  
- SW `CACHE_VERSION`、是否预缓存裸 config  
- Cache-Control / CF-Cache-Status / ETag  

### 3. 以后 CEO 是否不需要再人工检查？

**主路径不用再人肉点网页验收。**  
但在 Cloudflare **没有 Cache Purge 权限** 时，若毒缓存仍在，系统会 **自动判 FAIL** 并写明 **Manual Action Required**——你只需在 CF 控制台点 Purge，不必自己猜是哪张页坏了。

### 4. 哪些步骤仍需 Cloudflare 人工权限？

| 步骤 | 现状 |
|------|------|
| Zone Cache Purge API | Token 无权限 → 人工 Purge |
| Purge Everything | 人工（可选） |
| 授予 Cache Purge 给专用 Token | 人工（一次配置） |

获得权限后，Release Manager 会自动 purge：`config.js` / `sw.js` / `components.js` / 首页等。

## 长期改进（未改业务页）

统一 `?v=<REL-…>` 替换人工 `apcontact-002`：见 `release-asset-versioning.md`（Phase-2）。  
本任务只加了 `config.releaseId` stamp + 校验基础设施，**未改 SEO/页面文案/业务逻辑**。
