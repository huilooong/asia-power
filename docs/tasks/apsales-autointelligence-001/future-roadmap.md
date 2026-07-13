# APSALES-AUTOINTELLIGENCE-001 — Future Roadmap

---

## 最终目标

**AsiaPower Vehicle Intelligence**（不是 VIN Decoder 产品）。

每一次 VIN / OE / 发动机铭牌 / 变速箱铭牌 / 图片 / 客户反馈 / 人工修正  
→ 沉淀到同一 **Vehicle Knowledge**。

长期逐步降低：外部 Decoder、API、LLM、Token 依赖。  
Sales Decision **优先**自有 Knowledge；外部 Provider 仅补充。

---

## Provider 链（CEO 定稿）

```
AsiaPower VIN Store → NHTSA vPIC → corgi fallback → Manual Review
```

| 阶段 | 实现 |
|------|------|
| **Phase 1（当前）** | Store + **NHTSA only**（标注 Provider Reported） |
| Phase 2+ | 接入 corgi 离线 Fallback |
| 持续 | Manual Review 升格 Verified |

**Phase 1 ≠ 最终方案。**

---

## Now（Phase 1）

- CI ∈ Sales Decision；无 Engine / Service  
- known/missing → 少问、短回（Business First）  
- 字段：provider_source / raw / normalized / confidence / verification_status / VIN 脱敏  
- 不接汽修宝到 APSales  

---

## Future Product（产品方向 — **现在不开发**）

### VIN Search（网站搜索栏）

客户输入 VIN / Chassis Number →

```
Vehicle Intelligence
  ↓
Vehicle Snapshot
  ↓
自动匹配：Engine / Gearbox / Half Cut / Chassis Parts
  ↓
Request Quote
```

**本阶段禁止：** 搜索页、前端、VIN Search API 实现。

**本阶段保证数据模型可支撑未来：**

1. VIN 查询  
2. Vehicle Snapshot  
3. 一车对应多个 Engine / Gearbox / Compatible Parts  
4. 兼容关系：`source` / `confidence` / `verification_status`  
5. VIN 默认脱敏保存与展示  
6. 未来 VIN Search API  

（见 `VehicleSnapshot.compatible` 预留结构。）

---

## Next（客户增多）

| 动作 | 目的 |
|------|------|
| 沉淀 VIN → Store | 提高命中、少外呼 |
| Manual Correction | 升 Verified |
| Customer Feedback | 纠错 |
| Evidence：少问是否更快成交 | 证明 Decision |

---

## Later — 多入口

OE / Engine Plate / Transmission Plate / Vehicle Image / Feedback / Manual Correction  
→ 同一 Knowledge。

---

## 子龙

汽修宝服务采购；与 APSales 共享 Snapshot 形状，不共享强制 Provider。

---

## Never

- 新 Engine / Service  
- 把 Phase 1 NHTSA 写成最终方案  
- 把 Provider Reported 当成 Verified  
- 现在做 VIN Search 前端  
