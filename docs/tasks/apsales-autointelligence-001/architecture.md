# APSALES-AUTOINTELLIGENCE-001 — Architecture

**状态：** CEO 有条件批准（最终 Provider 决策）已落实 · 进入部署  
**硬约束：** 不新增 Engine / Service；CI ∈ Sales Decision。

---

## 1. 最终设计目标

**VIN Decoder 不是最终目标。**  
最终目标：**AsiaPower Vehicle Intelligence**。

VIN / OE / 铭牌 / 图片 / 反馈 / 人工纠正 → 同一 Vehicle Knowledge。

---

## 2. Provider 查询链（CEO 定稿）

```
AsiaPower VIN Knowledge Store
        ↓
NHTSA vPIC                 ← Phase 1 主外呼（Provider Reported）
        ↓
@cardog/corgi              ← Phase 2+ 离线 Fallback（未实现）
        ↓
Manual Review
```

| 说明 | |
|------|--|
| Phase 1 | **仅 Store + NHTSA** — **不是最终方案** |
| QXB | 子龙；不接 APSales |
| Verified | 仅 Manual / CEO 定稿；NHTSA ≠ Verified |

详见 `provider-decision.md`。

---

## 3. 数据流

```
Customer Message
  → Customer Intelligence（Knowledge → NHTSA…）
  → Sales Decision（known / missing）
  → Truth Guard
  → Reply（短；少问）
  → Evidence + Vehicle Knowledge 沉淀
```

---

## 4. 模型能力（支撑未来 VIN Search）

`VehicleSnapshot` 含：

- provider_source / raw_ref / confidence / verification_status  
- vin_masked / vin_hash（默认脱敏展示）  
- compatible.{engines, gearboxes, half_cuts, chassis_parts, relations[]}  

未来产品 VIN Search（网站搜 VIN → 匹配件 → Request Quote）**现在不开发**；模型已预留。

---

## 5. 生产目标（不变）

Business First：客户发 VIN → 利用已有信息 → 少问 → 少错 → 提高成交。  
不是生成更长回复。
