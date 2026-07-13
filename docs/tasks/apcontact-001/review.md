# APCONTACT-001 — Review（事故后）

## 是否可宣称「迁移完成」？

**否（此前过早）。** 源站改号 ≠ 公网验收完成。

当前：**主访问路径（营销首页 + 带 cache-bust 的 config）已指向 +86**；  
**裸 `config.js` / 裸 `sw.js` 仍被 Cloudflare 冻住旧内容**，必须在控制台 Purge 后才能称「全部公网干净」。

## 事故教训（写入规则）

1. 验收必须 curl **裸路径 + bust 路径**，不能只看 `?v=`  
2. JS 禁止再发 `max-age=31536000, immutable`（已改 config/components/sw）  
3. Service Worker 禁止预缓存裸 `/js/config.js`  
4. 无 Cache Purge 权限时，只能靠 **改 query / 改文件名** 绕过，并明确告知 CEO  
5. 生产 `public/` 残留页（campaigns、truck-heads、兜底 JS）必须纳入仓库与验收清单  

## 成功 / 失败 / 下一步

| 成功 | 失败 / 残留 | 下一步 |
|------|-------------|--------|
| 营销首页公网正确；主路径 WhatsApp = +86 | 裸 config/sw CF 毒缓存未清 | CEO Cloudflare Purge |
| 残留硬编码与 JS 兜底已改 | home/chrome Release 脚本校验偶发失败 | 可选重跑 chrome 校验 |
| 白名单未开 |  | Purge 后再公网抽查裸 config.js |

## 禁止继续

- 不解除 WhatsApp 白名单  
- 不开放陌生客户进 +86  
- 不开始其它开发，直到 CEO 确认 Purge + 本机无旧 SW
