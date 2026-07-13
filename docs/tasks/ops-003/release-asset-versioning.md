# OPS-003 — Release Asset Versioning（Phase-2 计划）

## 目标

Release Manager 统一管理：

```
?v=<REL-20260713103126>
```

写入 / 引用：

- `js/config.js`
- `js/components.js`
- `sw.js`
- `js/main.js`
- `css/styles.css`（及关键 chrome CSS）

禁止继续人工维护：`apcontact-002` / `seo-010` 等散装版本号。

## Phase-1（本任务已做）

- 公网解析校验强制进 Release  
- `ASIAPOWER.releaseId` 字段 + 远程 stamp  
- Cloudflare purge 尝试 + Manual Action Required  

## Phase-2（下次 OPS，需单独批准）

1. Deploy 时生成 `release-bust = releaseId`  
2. 对 **已部署 HTML** 做受控替换：`config.js?v=*` → `config.js?v=<REL>`（仅部署产物，或仓库统一脚本）  
3. `pwa-install` 注册 `/sw.js?v=<REL>`  
4. 校验：页面引用的 bust 必须等于本次 `release_id`  

**本任务刻意未改页面/SEO**，避免与「禁止修改页面」冲突。
