# B · 救活已曝光零点击页 — Title/Description 提案（待 CEO 批）

**日期：** 2026-07-21  
**原则：** 不新建国家页；用现网真实库存数改 SERP 文案；先改 8 页验证。

现网库存（API `approved`，2026-07-21）：共 **541** 条。

| 品牌 | 条数 |
|------|------|
| Hyundai | 84 |
| Honda | 80 |
| Toyota | 73 |
| Nissan | 46 |
| Kia | 39 |
| Geely | 8 |
| Mitsubishi | 4 |

高频发动机代码：G4FC 34 · R20A3 32 · 1ZR-FE 29 · HR16DE 21 · 2AZ-FE 13

---

## 拟改 8 页（Before → After）

### 国家页（模板味重 → 带库存事实）

| URL | 现 title | 拟 title | 拟 description（要点） |
|-----|----------|----------|------------------------|
| `/engines/ghana-half-cut-engines.html` | Half-Cut Engines for Ghana Importers \| AsiaPower | Used Engines & Half-Cuts for Ghana — 540+ China Stock \| AsiaPower | EXW Zhengzhou · CIF Tema quotes · Toyota/Honda/Hyundai codes in stock · WhatsApp same day |
| `/engines/nigeria-half-cut-engines.html` | Half-Cut Engines for Nigeria Importers \| AsiaPower | Used Engines Export to Nigeria — Live China Inventory \| AsiaPower | Confirm engine code + photos before ship · EXW/CIF · Japanese & Korean platforms |
| `/engines/kenya-half-cut-engines.html` | Half-Cut Engines for Kenya Importers \| AsiaPower | Used Engines for Kenya Importers — Verified China Stock \| AsiaPower | Donor match + gearbox pairing · export packing · quote before payment |
| `/engines/benin-half-cut-engines.html` | Half-Cut Engines for Benin Importers \| AsiaPower | Moteurs & Half-Cuts pour le Bénin — Stock Chine \| AsiaPower | (法/英双语 title 可选) EXW Chine · photos + codes moteur · devis WhatsApp |
| `/engines/africa-half-cut-engines.html` | Half-Cut Engines for Africa Importers \| AsiaPower | Used Engines for Africa — 500+ Half-Cuts & Powertrains \| AsiaPower | West & North Africa ports · brand hubs · real stock IDs, not brochure pages |

### 品牌页

| URL | 现 title | 拟 title |
|-----|----------|----------|
| `/brands/honda.html` | Honda — Engines, Gearboxes & Half-Cuts \| AsiaPower | Honda Engines & Half-Cuts in Stock (80+) — R20A3, K24A8 \| AsiaPower |
| `/brands/hyundai.html` | Hyundai — Engines, Gearboxes & Half-Cuts \| AsiaPower | Hyundai Engines & Half-Cuts in Stock (84+) — G4FC, G4NA \| AsiaPower |
| `/brands/geely.html` | Geely — Engines, Gearboxes & Half-Cuts \| AsiaPower | Geely Engines & Gearboxes — Live China Export Stock \| AsiaPower |

---

## 内链（第二步，title 批完再做）

- 首页 / `contact.html` 增加「按市场 / 按品牌」入口链到上述 8 页（不是再扩新页）。

## 验证

- 部署后 4 周对比 GSC：这 8 页的点击与 CTR。
- **CEO 已批 2026-07-21「标题方案 OK」**；Hyundai 按指示改为 **84+**。HTML 已改，随本任务部署。
