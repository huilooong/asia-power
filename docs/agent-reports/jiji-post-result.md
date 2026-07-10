# Jiji Post Result

**Run time:** 2026-07-05 15:56 UTC
**Mode:** probe (API only)
**Script:** `scripts/jiji-post.py`

## Ad content

| Field | Value |
|-------|-------|
| Title | Used Engines & Auto Parts from China — AsiaPower |
| Description | AsiaPower exports used Japanese & Korean engines, half-cuts, gearboxes and auto … |
| Category | Auto Parts & Accessories (Vehicle Parts & Accessories) (id=54) |
| Price | Contact for price |

## Registration (if you don't have an account)

1. Open **Ghana:** https://jiji.com.gh/registration.html or **Nigeria:** https://jiji.ng/registration.html
2. Click **Registration**, enter email, password, first/last name.
3. Verify email or phone if Jiji prompts you.
4. Export credentials:
   ```bash
   export JIJI_EMAIL='your@email.com'
   export JIJI_PASSWORD='your-password'
   ```
5. Re-run: `.venv/bin/python3 scripts/jiji-post.py`

> Note: Ghana and Nigeria are separate Jiji markets — you may need one account per site.

## Results

### Jiji Ghana (https://jiji.com.gh)

| Item | Value |
|------|-------|
| Status | ✅ Success |
| Stage | probe |
| Message | API reachable; sign-in endpoint accepts CSRF (credentials not tested) |

<details><summary>Technical details</summary>

```json
{
  "csrf_ok": true,
  "sign_in_probe": {
    "http_status": 200,
    "body": {
      "status": "error",
      "error": "Email, phone or password is incorrect. Please try again."
    }
  }
}
```

</details>

### Jiji Nigeria (https://jiji.ng)

| Item | Value |
|------|-------|
| Status | ✅ Success |
| Stage | probe |
| Message | API reachable; sign-in endpoint accepts CSRF (credentials not tested) |

<details><summary>Technical details</summary>

```json
{
  "csrf_ok": true,
  "sign_in_probe": {
    "http_status": 200,
    "body": {
      "status": "error",
      "error": "Email, phone or password is incorrect. Please try again."
    }
  }
}
```

</details>

## API notes (for engineers)

- Bootstrap: `GET /api_web/v0/start_spa_data` → CSRF token in `data.token`
- Login: `POST /api_web/v1/sign-in` with header `X-CSRF-Token` + `Referer`
- Create flow: `GET /api_web/v1/item-create/add.json` → `advert_id`, `modify_advert_url`
- Form: `GET /api_web/v1/item-create/form_fields.json?category_id=54&title=...`
- Photos: `POST /image-upload/{advert_id}` (multipart, field `advert_image`)
- Submit: `POST {modify_advert_url}` with JSON payload

## Next steps

1. Set `JIJI_EMAIL` / `JIJI_PASSWORD` and re-run without `--probe`.
2. Pass `--image /path/to/product.jpg` (Jiji typically requires ≥2 photos).
3. Confirm listing appears under *My Adverts* on each Jiji site.
