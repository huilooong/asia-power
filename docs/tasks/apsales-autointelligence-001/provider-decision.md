# APSALES-AUTOINTELLIGENCE-001 — Provider 决策（CEO 最终）

## 查询链（定稿）

```
AsiaPower VIN Knowledge Store   ← 第一优先；高置信度直接复用，不重复外呼
        ↓
NHTSA vPIC                      ← Phase 1 主解析 Provider（Provider Reported）
        ↓
@cardog/corgi                   ← 第二优先离线 Fallback（Phase 2+，本阶段未实现）
        ↓
Manual Review
```

## 角色

| Provider | 角色 | 本阶段 |
|----------|------|--------|
| AsiaPower Store | 自有知识，优先 | ✅ |
| NHTSA vPIC | 官方/免费/结构化；主外呼 | ✅ Phase 1 |
| corgi | 离线/网络异常备用 | ❌ 未实现（已预留） |
| QXB 汽修宝 | 子龙采购 | ❌ 不接 APSales |

## 重要标注

- **Phase 1 = 仅实现到 NHTSA**，不是最终方案。  
- NHTSA 字段默认 **`verification_status=provider_reported`**，**不是 Verified**。  
- 只有 Manual Review / CEO 定稿可升为 `verified` / `manual_reviewed`。

## 数据字段（已实现）

| 字段 | 状态 |
|------|------|
| Provider Source (`provider_source`) | ✅ |
| Raw Response 保存 (`data/vehicle_knowledge/raw/`) | ✅ |
| Normalized Vehicle Record (`VehicleSnapshot`) | ✅ |
| Confidence | ✅ |
| Verification Status | ✅ |
| VIN 脱敏 (`vin_masked` / 展示默认脱敏) | ✅ |
| Compatible parts 结构预留 | ✅（空壳，供未来 VIN Search） |
