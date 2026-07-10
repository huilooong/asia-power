# OPS · Portal registration deploy

**Status:** Production deployed via Release Manager (`portal` + `api`)

## What shipped

| Item | Path |
|------|------|
| Unified login / register | `/login/` |
| Supplier register API | `POST /api/supplier/register` |
| Phone OTP | `POST /api/auth/phone/send` · `verify` |
| Supplier dashboard | `/supplier-portal/dashboard.html` |
| Buyer portal | `/buyer-portal/` |
| Marketing page CTA | `/supplier-portal.html` → real register (no fake form) |

## Deploy

```bash
node scripts/deploy-production.mjs api --yes --allow-dirty
node scripts/deploy-production.mjs portal --yes --allow-dirty
node scripts/verify-production.mjs
```

## Supplier flow

1. Open https://asia-power.com/login/?role=supplier&mode=register
2. Fill company profile + phone
3. Send OTP → Create account
4. Land on supplier dashboard

Demo OTP currently enabled on production (`PHONE_OTP_DEMO`); supplier demo code is typically `888888`.

## Notes

- Old `supplier-portal.html` fake registration form removed — redirects to `/login/?role=supplier&mode=register`
- New deploy target: `portal`
- Real SMS / Google / Facebook keys still optional; demo modes work until configured
