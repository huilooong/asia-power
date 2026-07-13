# APSALES-AUTOINTELLIGENCE-001 — Implementation

**状态：✅ Phase 4 完成 · 进入部署**

---

## Phase 1 范围（明确）

**仅：** AsiaPower Store + **NHTSA vPIC**  
**不是**最终方案。corgi / Manual Review 升格 / VIN Search 前端 = 以后。

NHTSA 字段一律 **`provider_reported`**，不是 Verified。

---

## 已实现字段

| 字段 | 状态 |
|------|------|
| Provider Source | ✅ `provider_source` |
| Raw Response | ✅ `data/vehicle_knowledge/raw/` |
| Normalized Record | ✅ `VehicleSnapshot` |
| Confidence | ✅ |
| Verification Status | ✅ |
| VIN 脱敏 | ✅ `vin_masked` + 展示默认脱敏 |
| Compatible 预留 | ✅ 空结构（未来 VIN Search） |

---

## 查询链

Store → NHTSA →（corgi 未实现）→ Manual Review

---

## 关键文件

见 `changed-files.txt`。
