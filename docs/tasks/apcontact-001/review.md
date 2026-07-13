# APCONTACT-001 — Review

## Status

**本地迁移 + 生产已生效。** 默认入口统一为 `+86 166 3880 1930`。

## 成功 / 失败 / 下一步

| 项 | 状态 |
|----|------|
| Commit / push | ✅ `18c422ce9` + cache-bust `8b5518ab9` / `5495b05a5` |
| 生产文件同步 | ✅ 首页/Contact/engines/config/签名等已在现网 |
| Release Manager | ✅ engines `REL-20260713102618-engines-d7ed495d2` · api `REL-20260713102855-api-d7ed495d2` · portal `REL-20260713103005-portal-d7ed495d2` · apsales `REL-20260713103126-apsales-d7ed495d2` |
| home/chrome 目标脚本 | ⚠️ 校验 SSH 偶发失败；内容已用同 commit rsync 覆盖并现网验证 |
| 现网抽查 | ✅ `config.js?v=apcontact-001` → +86；contact/home/engines wa.me/8616638801930 |

## 现网确认

- https://asia-power.com/js/config.js?v=apcontact-001
- https://asia-power.com/contact.html
- https://asia-power.com/

