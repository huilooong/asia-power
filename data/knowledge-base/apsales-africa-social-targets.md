# 子敬 · 非洲社媒目标清单（FB + X）

> **今日任务（2026-07-04）**：Facebook + X 找非洲汽配商、修理厂、二手车进口商。Instagram **今日暂停**。  
> KPI：`asia-power.com` + `sales@asia-power.com`

---

## 一、Facebook 小组类别

### 🇬🇭 Ghana / Tokunbo

| 类型 | 搜索词 | 互动方式 |
|------|--------|----------|
| Tokunbo 二手车 | `Ghana tokunbo`, `Tema port cars`, `Accra spare parts` | 先评论帮别人询价，再每周 1 主帖 |
| 拆车/半切 | `Ghana half cut`, `Ghana JDM parts` | 附 engine code 科普评论 |
| 卡车 | `Ghana truck parts`, `HOWO Ghana` | 链 `half-cuts/` 或 `trucks/` |

### 🇳🇬 Nigeria / Spare Parts

| 类型 | 搜索词 | 互动方式 |
|------|--------|----------|
| 拉各斯汽配 | `Lagos spare parts`, `Apapa tokunbo` | 帮助型评论，不硬广 |
| 进口商 | `Nigeria auto parts importer`, `CIF Lagos` | 关注 Page，评论 1–2 次/天 |
| 丰田专线 | `Corolla engine Lagos`, `Camry half cut Nigeria` | 型号精准回复 |

### 🇰🇪 Kenya / Used Cars

| 类型 | 搜索词 | 互动方式 |
|------|--------|----------|
| 蒙巴萨进口 | `Mombasa import cars`, `Kenya used cars` | 评论港口/清关话题 |
| 修理厂 | `Kenya auto repair`, `Nairobi spare parts` | 链发动机目录 |
| Hilux/Hardbody | `Toyota Hilux engine Kenya` | engine code 评论 |

**入组规则**：CEO 把小组 URL 加到 `config/apsales_fb_target_groups.yaml` → Autopilot 按频率发帖。

---

## 二、X (Twitter) 搜索查询

每日轮换 2–3 条搜索（`config/apsales_social_engagement_policy.yaml` 内也有）：

```
tokunbo spare parts Ghana
Nigeria auto parts importer
Kenya half cut Toyota
Lagos tokunbo dealer
Accra spare parts
Mombasa used car parts
#Tokunbo #AutoParts
#HalfCut Japan Africa
```

**动作**：看帖 → 有帮助才评论 → 关注 dismantling/used car 从业者（修理厂、进口商类型账号，非个人买家）。

---

## 三、关注对象类型（不列具体人名 — 现场搜索后入库）

| 类型 | 识别特征 | 平台 |
|------|----------|------|
| 非洲汽配 Page/账号 | Bio 含 spare parts, tokunbo, importer, workshop | FB + X |
| 半切/拆车从业者 | 发 engine code、yard photos、container 装柜 | FB + X |
| 二手车进口商 | port, CIF, clearing, Tema/Apapa/Mombasa | FB 为主 |
| 修理厂 | repair, garage, mechanic + 车型 | FB Groups |
| **不关注** | 纯个人买家、spam 号、无头像新号 | — |

---

## 四、评论示例（human tone · EN）

**不带链接（优先）**

> Good question — always match engine + gearbox codes from the donor VIN before you commit on a half-cut.

> For rebuild shops, 2NZ-FE and HR16DE are steady — ask for compression test photos, not just yard shots.

**带链接（仅当帖文明确在找供应商/半切）**

> We help workshops browse verified half-cuts with photos — no pressure in DMs: https://asia-power.com/half-cuts/

> For a quote with photos: sales@asia-power.com — mention your model + engine code.

**禁止**：同一帖连评、复制粘贴、每分钟一条、未读帖就发链接。

---

## 五、CEO 如何加 FB 小组

1. 打开 `config/apsales_fb_target_groups.yaml`
2. 在 `groups:` 下追加：

```yaml
  - group_url: "https://www.facebook.com/groups/你的小组ID"
    name: "小组名称"
    market: "Ghana"
    language: "en"
```

3. 部署到生产（或 git pull）→ 下次 Autopilot 周期会自动纳入发帖计划

---

## 六、频率提醒

见 `config/apsales_social_engagement_policy.yaml`：

- FB 主帖 2–3/天 · X 3–5/天
- 动作间隔 45–120 分钟随机
- 评论 ≤3/小时 · 关注 ≤15/天
- 活跃窗口 UTC 08:00–20:00（覆盖西非到东非白天）
