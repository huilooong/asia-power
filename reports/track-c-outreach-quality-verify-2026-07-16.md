# Track C 外发质量修复 — 真实案例复验（含重生成草稿）

数据：生产 `contact-leads.json` + 生产 `half-cut-approved.json`（本地只读复验，未发送）。

## Tom | `davidsontom36@gmail.com`
- merged_lead_count: **1**
- product: HC250194 (Hyundai Sonata G4KE)
- brand/model/hc_id: Hyundai / Sonata / HC250194
- ref_ids: `['lead-3d06f7d7c4de']`

### Subject
AsiaPower — your enquiry about HC250194 (Hyundai Sonata G4KE)

### Customer draft
```
Hi Tom,

Thank you for contacting AsiaPower from Ghana. We connect verified China suppliers with workshops and parts dealers across Africa.
You asked about HC250194 (Hyundai Sonata G4KE) — we have supplier-verified options with photos and engine codes on our site.

Browse half-cuts, engines and gearboxes with EXW pricing:
https://asia-power.com/half-cuts/

Reply to this email with your engine code or vehicle model — we will confirm availability and send photos.

WhatsApp: +86 166 3880 1930
Best regards,
AsiaPower Sales Team
sales@asia-power.com
```

### Check
- LLM ok: True
- Mentions specific stock/model (manual): look for HC / brand in draft above
- Not generic interest question: PASS-ish

---

## Arthur Isaac | `arthurisaac6516@gmail.com`
- merged_lead_count: **1**
- product: HC250517 (Toyota Corolla 1ZR-FE)
- brand/model/hc_id: Toyota / Corolla / HC250517
- ref_ids: `['lead-4f27f68bf89f']`

### Subject
AsiaPower — your enquiry about HC250517 (Toyota Corolla 1ZR-FE)

### Customer draft
```
Hi Arthur,

Thank you for contacting AsiaPower from Ghana. We connect verified China suppliers with workshops and parts dealers across Africa.
You asked about HC250517 (Toyota Corolla 1ZR-FE) — we have supplier-verified options with photos and engine codes on our site.

Browse half-cuts, engines and gearboxes with EXW pricing:
https://asia-power.com/half-cuts/

Reply to this email with your engine code or vehicle model — we will confirm availability and send photos.

WhatsApp: +86 166 3880 1930
Best regards,
AsiaPower Sales Team
sales@asia-power.com
```

### Check
- LLM ok: True
- Mentions specific stock/model (manual): look for HC / brand in draft above
- Not generic interest question: PASS-ish

---

## Godson | `sitesdomreg@gmail.com`
- merged_lead_count: **4**
- product: HC250517 (Toyota Corolla 1ZR-FE), Toyota Corolla 2ZR-FE, HC250480 (Toyota Corolla 1ZR-FE)
- brand/model/hc_id: Toyota / Corolla / 
- ref_ids: `['lead-10e876b71671', 'lead-fed9ca4797cb', 'lead-5f41e1d2d870', 'lead-99843eb500ff']`

### Subject
AsiaPower — your enquiry about HC250517 (Toyota Corolla 1ZR-FE), Toyota Corolla 2ZR-FE, HC250480 (Toyota Corolla 1ZR-FE)

### Customer draft
```
Hi Godson,

Thank you for contacting AsiaPower from Ghana. We connect verified China suppliers with workshops and parts dealers across Africa.
You asked about HC250517 (Toyota Corolla 1ZR-FE), Toyota Corolla 2ZR-FE, HC250480 (Toyota Corolla 1ZR-FE) — we have supplier-verified options with photos and engine codes on our site.

Browse half-cuts, engines and gearboxes with EXW pricing:
https://asia-power.com/half-cuts/

Reply to this email with your engine code or vehicle model — we will confirm availability and send photos.

WhatsApp: +86 166 3880 1930
Best regards,
AsiaPower Sales Team
sales@asia-power.com
```

### Check
- LLM ok: True
- Mentions specific stock/model (manual): look for HC / brand in draft above
- Not generic interest question: PASS-ish

---

## Fabian Danku | `fabiandanku@yahoo.com`
- merged_lead_count: **4**
- product: HC250087 (Hyundai ix35 G4KE), HC250306 (Hyundai Santa Fe G4KC), Hyundai 胜达经典 G4KE
- brand/model/hc_id: Hyundai / ix35 / 
- ref_ids: `['lead-746d10dbbc14', 'lead-f325760c220d', 'lead-f1f272fcefb1', 'lead-97ad31f9d57d']`

### Subject
AsiaPower — your enquiry about HC250087 (Hyundai ix35 G4KE), HC250306 (Hyundai Santa Fe G4KC), Hyundai 胜达经典 G4KE

### Customer draft
```
Hi Fabian,

Thank you for contacting AsiaPower from Ghana. We connect verified China suppliers with workshops and parts dealers across Africa.
You asked about HC250087 (Hyundai ix35 G4KE), HC250306 (Hyundai Santa Fe G4KC), Hyundai 胜达经典 G4KE — we have supplier-verified options with photos and engine codes on our site.

Browse half-cuts, engines and gearboxes with EXW pricing:
https://asia-power.com/half-cuts/

Reply to this email with your engine code or vehicle model — we will confirm availability and send photos.

WhatsApp: +86 166 3880 1930
Best regards,
AsiaPower Sales Team
sales@asia-power.com
```

### Check
- LLM ok: True
- Mentions specific stock/model (manual): look for HC / brand in draft above
- Not generic interest question: PASS-ish

---


## Fabian CJK gate re-check (after product sanitize)

- raw product (internal): `HC250087 (Hyundai ix35 G4KE), HC250306 (Hyundai Santa Fe G4KC), Hyundai 胜达经典 G4KE`
- subject: AsiaPower — your enquiry about HC250087 (Hyundai ix35 G4KE), HC250306 (Hyundai Santa Fe G4KC), Hyundai G4KE
- body product line: ['You asked about HC250087 (Hyundai ix35 G4KE), HC250306 (Hyundai Santa Fe G4KC), Hyundai G4KE — we have supplier-verified options with photos and engine codes on our site.']
- CJK in subject/body: **none**
