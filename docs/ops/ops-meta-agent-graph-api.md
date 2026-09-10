# OPS · Facebook 电脑 Google 验证（死胡同记录）

**Status:** 电脑 Google OAuth **过不去**（2026-09-10 CEO 实测）  
**错误：** `redirect_uri=https://web.facebook.com/oauth2/redirect/` → Google 400 `redirect_uri_mismatch`

## 已否决 / 已失败

| 做法 | 结果 |
|------|------|
| 改地址栏 web→www | Facebook 强制跳回 web，打转 |
| Google Cloud 登记该 URI | 那是 Facebook 的域名，咱们项目加不上 |
| 插件改 Google 回跳 | CEO 仍过不了认证 |
| Graph Explorer | 走不通 |
| 手机 App 已登录 | 不能给电脑 Agent 用会话 |

## 剩余唯一门（手机改验证方式）

电脑这条 Google 认证是 Facebook 用 Gmail 做「是不是本人」。要绕开，必须在**已登录的手机 App**里加上手机号和独立密码，电脑改走 **mbasic + 手机号/密码**，不要再点「使用 Google 验证」。

1. 手机 Facebook App（保持登录）
2. 菜单 → 设置与隐私 → 设置 → **账号中心**
3. **密码与安全** → **密码** → 设一个 Facebook 自己的密码（记住）
4. **个人详情** → **联系方式** → **添加手机号** → 收短信验证
5. 电脑关掉无痕；打开 https://mbasic.facebook.com/
6. 用 **手机号 + 刚设的密码** 登录（不要点 Google）
7. 登录成功后再开 https://web.facebook.com/ 看是否已进

## 剩余门（手机号仍跳 Google 之后）

电脑输入手机号/密码也会进「使用 Google 验证」——这是 Gmail 身份核验，不是登录方式选错。

1. **扫码（优先）**：电脑打开登录页，**不要输入账号密码**，找「二维码 / 用手机应用登录」。手机 Facebook App 扫码确认。
2. **蓝按钮不要点**：若仍到「使用 Google 验证」，找「其他方式 / Try another way」，用手机 App 通知批准。
3. **去掉 Gmail 核验**：手机 App 账号中心 → 联系方式 → 先确保手机号可用 → 再移除或取消首选 `gooddlong@gmail.com`（先加一个非 Gmail 邮箱更稳）。然后电脑再试。

