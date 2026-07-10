# OPS · portal-deposit-v1

**Status:** Production deployed (`portal` + `api` targets) · OTP demo mode until real SMS keys configured

## Deliverables

| Item | Path |
|------|------|
| Preview pack | `docs/previews/portal-deposit-v1/` |
| Supplier dashboard | `supplier-portal/dashboard.html` |
| Buyer portal | `buyer-portal/index.html` |
| Unified login / register | `login/index.html` · `js/login.js` |
| Phone OTP | `server/lib/phone-otp-auth.js` |
| Orders | `server/lib/buyer-orders.js` |
| Stripe deposit | `server/lib/stripe-deposit.js` |
| Phone normalize | `server/lib/phone-normalize.js` |
| My uploads API | `GET /api/half-cuts/my-uploads` |
| Edit own listing | `GET/PATCH /api/half-cuts/my-uploads/:id`（仅本人） |
| Edit company profile | `PUT /api/supplier/profile` |
| Backfill script | `scripts/backfill-supplier-phone-ownership.mjs` |
| Deploy target | `node scripts/deploy-production.mjs portal` |

## Preview URL

```bash
cd /Users/longhui/Desktop/AsiaPower
python3 -m http.server 8791
```

Open: http://127.0.0.1:8791/docs/previews/portal-deposit-v1/

API smoke (local half-cut server on 8787):

```bash
PHONE_OTP_DEMO=1 STRIPE_DEMO=1 node server/half-cut-local-server.js
```

## 统一登录（新增）

| 项 | 说明 |
|------|------|
| 入口 | 全站顶栏 / 搜索栏旁 **Sign in / 登录** → `/login/` |
| 同一页 | Buyer / Supplier 切换，不再分两个登录页 |
| 买家 | **Google / Facebook** 优先；也可手机 OTP |
| 供应商 | 手机 OTP 登录 / 注册 + 资料补全 |
| OAuth 演示 | 未配置密钥时走 `/api/auth/oauth/demo` |

环境变量：`GOOGLE_OAUTH_CLIENT_ID/SECRET`、`FACEBOOK_APP_ID/SECRET`、`OAUTH_DEMO=1`



## Validation checklist

- [ ] Preview three pages open
- [x] Supplier OTP → my-uploads
- [x] Supplier 编辑公司资料 + 编辑自己商品详情（ownership 校验）
- [ ] Buyer OTP → orders → demo Pay Deposit → Reserved
- [ ] Guest WhatsApp / inquiry unchanged
- [ ] No secrets committed

## 供应商自助编辑（2026-07-10）

| 能力 | 入口 |
|------|------|
| 公司资料 | 工作台「编辑公司资料」→ `PUT /api/supplier/profile` |
| 商品详情 | 上传列表「编辑」→ `GET/PATCH /api/half-cuts/my-uploads/:id` |

可改字段：品牌/型号/年款/价格/发动机号/变速箱号/驱动/里程/库存状态/短描述/备注。  
不能改别人的货；审核状态（pending/approved）由系统管，供应商不能自己改审核结果。
