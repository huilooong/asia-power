# OPS · 手机号 + 密码登录（买家 & 供应商）

**状态：** ✅ **已上生产**（CEO 紧急纠正 2026-07-10：客户必须能用手机号+密码登录，无验证码）  
**日期：** 2026-07-10  
**任务 ID：** phone-password-auth  
**Release ID：** `REL-20260710093826-portal-76489479`

---

## 结论

| 项 | 状态 |
|----|------|
| 买家：手机号+密码注册/登录 | ✅ 现网可用（无短信） |
| 供应商：手机号+密码登录 / 设密改密 | ✅ 现网可用（无短信，靠手机号匹配） |
| 供应商历史上传不丢 | ✅ 按手机号归属 |
| Google | ✅ 保留为次要 |
| 短信验证码 UI | ⏸ **已隐藏**（后端路由可保留，用户看不到） |
| Facebook | ✅ 不恢复 |
| 生产：密码整包 | ✅ 已部署 portal |

---

## 现网主路径（客户一眼能用）

| 角色 | 怎么走 |
|------|--------|
| 买家注册 | 手机号 + 密码 + 确认密码（可选邮箱/公司名） |
| 买家登录 | 手机号 + 密码；或 Google |
| 供应商设密 | 手机号匹配已有账号 **或** 历史上传 `supplierPhone*` → 直接设密（二次确认） |
| 供应商注册 | 公司资料 + 手机号 + 密码（二次确认） |
| 供应商登录 | 手机号 + 密码 |

**不要**要求发验证码才能登录。重新开启短信：设 `AUTH_REQUIRE_SMS_OTP=1` 并恢复 OTP UI。

---

## 部署记录

| 项 | 值 |
|----|----|
| Release ID | `REL-20260710093826-portal-76489479` |
| Target | portal |
| 备份 | `/root/.openclaw/workspace/inventory-site/backups/scheduled/asia-power-backup-20260710-093828.tar.gz` |
| 回滚 | `RESTORE_CONFIRM=REL-20260710093826-portal-76489479 node scripts/release-restore.mjs REL-20260710093826-portal-76489479` |
| 现网 | https://asia-power.com/login/ |
| 证据 HTML | `docs/ops/evidence/login-phone-pw-live-20260710.html` |
| 证据截图 | `docs/ops/evidence/login-phone-pw-live-20260710.png` / `…-supplier-….png` |

说明：API（`phone-password-auth.js`）此前已在生产；本次补上登录页 UI（此前只剩 Google +「等可以上线」提示）。

---

## 现网实测（测试号，未动真实客户）

| 路径 | 结果 |
|------|------|
| 买家注册 `+86 13800139901` | ✅ `ok`，无 OTP |
| 买家错密 | ✅ `手机号或密码错误` |
| 买家正确密码登录 | ✅ `ok` |
| 供应商注册 `+86 13900138801` | ✅ `ok`，无 OTP |
| 供应商设密/改密（无短信） | ✅ `ok` |
| 供应商新密码登录 | ✅ `ok` |
| 供应商旧密码 | ✅ 拒绝 |
| 登录页 HTML | ✅ 有 `buyer-password-box` / `supplier-password-box`；OTP `hidden`；无 Facebook |

---

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/phone/password/lookup` | 查是否已有账号 / 是否已设密 / 历史上传条数 |
| POST | `/api/auth/phone/password/register` | **买家**注册：手机+密码+确认（默认无 OTP） |
| POST | `/api/auth/phone/password/login` | 买家或供应商：手机+密码登录 |
| POST | `/api/auth/phone/password/set` | 设密/改密：默认无 OTP；供应商须手机匹配账号或历史上传 |
| POST | `/api/supplier/register` | 供应商注册：公司资料+密码（默认无 OTP） |

密码：PBKDF2-SHA512，`passwordSet: true`。日志只打脱敏手机，不打密码。

---

## 供应商匹配规则（硬性）

**唯一匹配键 = 手机号，不用公司名。**

| 侧 | 字段 |
|----|------|
| 账号 `data/users.json` | `phoneNormalized`（辅：`phone` + `countryCode`） |
| 库存 `half-cut-*.json` | 优先 `supplierPhoneNormalized`，否则 `supplierPhone` |

归一化：`server/lib/phone-normalize.js`。

---

## 安全取舍（无短信）

| 点 | 说明 |
|----|------|
| 供应商设密 | 知道历史上传用过的手机号即可设密/改密 |
| 缓解 | 限流；仅匹配已有账号或库存手机；不用公司名匹配 |
| 买家注册 | 手机号未短信验证（与多数「先注册后验证」类似） |
| 后续 | 国内短信通道就绪后恢复 OTP |

---

## 交付物

| 文件 | 作用 |
|------|------|
| `login/index.html` / `js/login.js` / `css/login.css` | 现网登录页（密码主路径，OTP 隐藏） |
| `server/lib/phone-password-auth.js` | 密码认证（默认无 OTP） |
| `docs/ops/ops-phone-password-auth.md` | 本报告 |
| `docs/ops/evidence/login-phone-pw-live-20260710.*` | 现网证据 |

---

## 下一步

1. ✅ 生产密码整包已上线（portal）
2. 国内短信就绪：`AUTH_REQUIRE_SMS_OTP=1` + 恢复 OTP UI
3. 可选：清理测试账号 `13800139901` / `13800139902` / `13900138801`（非真实客户）
