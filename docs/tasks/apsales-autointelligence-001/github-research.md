# APSALES-AUTOINTELLIGENCE-001 — GitHub / 开源 VIN Decoder 调研

**原则：** 不自研 VIN 算法；优先成熟开源；APSales 要**全球**能力；**不接汽修宝**（属子龙）。

---

## 1. 候选一览

| 项目 | 语言 | License | 数据源 | 成熟度 | 商业可用？ |
|------|------|---------|--------|--------|------------|
| **NHTSA vPIC API**（官方） | HTTP | 美国政府公开数据 | 厂家 565 申报 | 权威 | ✅ 免费（有流量控制） |
| **@cardog/corgi** ([cardog-ai/corgi](https://github.com/cardog-ai/corgi)) | TypeScript | **ISC** | 离线 vPIC SQLite | ⭐322，生产向 | ✅ ISC≈MIT 宽松 |
| **Wal33D/nhtsa-vin-decoder** | Python/Java/TS | **MIT** | 离线 WMI 2015+ + NHTSA API | 新但文档全 | ✅ MIT |
| **way-platform/vin-go** | Go | **MIT** | NHTSA + 德国 KBA 等 | 偏欧卡/商用车 | ✅ MIT |
| **adaptant-labs/vin-decoder-dart** | Dart | **Apache-2.0** | ISO + 可选 NHTSA | 中等 | ✅ Apache-2.0 |
| **ZmoleCristian/vin-decode** / ultravin 类 | Rust | 视仓库 | 嵌入 vPIC | 高性能离线 | 需确认具体 License |
| AsiaPower 现有 **QXB** | Node | 商业 API | 中国市场强 | 生产在用 | ⚠️ **APSales 本阶段禁用**；子龙专用 |

---

## 2. 市场覆盖（对 AsiaPower 的意义）

| 区域 | NHTSA vPIC / corgi / nhtsa-vin-decoder | QXB（汽修宝） | 说明 |
|------|----------------------------------------|--------------|------|
| **美国** | ⭐⭐⭐⭐⭐ | 弱 | vPIC 本职 |
| **欧洲**（常见乘用车） | ⭐⭐⭐～⭐⭐⭐⭐ | 中 | WMI + 部分欧系；vin-go 对德系商用更强 |
| **日本**（Toyota/Honda/Nissan…） | ⭐⭐⭐⭐ | ⭐⭐⭐ | 出口美欧车在 vPIC 较好；纯日规可能弱 |
| **韩国**（Hyundai/Kia） | ⭐⭐⭐⭐ | ⭐⭐⭐ | 同上 |
| **中国国产车** | ⭐⭐ | ⭐⭐⭐⭐⭐ | APSales 全球客户少依赖；子龙库存靠 QXB |

**现实：** 全球「一个库打天下」不存在。  
APSales Phase 1 应以 **NHTSA 系（官方 API 或 corgi 离线）** 作全球基线；中国深挖留给子龙 QXB。

---

## 3. License 结论（商业）

| License | 结论 |
|---------|------|
| MIT / ISC / Apache-2.0 | **可商用**，保留版权声明即可 |
| NHTSA 数据 | 政府公开数据，可解码使用；注意合理频率，勿滥用 |
| 汽修宝合同 | 已有库存用途；**不等于**授权给 APSales 对话免费无限用 |

---

## 4. 推荐（APSales Customer Intelligence 基线）

### 首选组合（批准实现后）

1. **主：NHTSA `DecodeVinValues` API**（零依赖、权威、免费）  
   - URL 形态：`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{VIN}?format=json`
2. **辅（可选）：`@cardog/corgi`**  
   - 离线、快、适合 Node/WhatsApp 同进程；降低官方 API 延迟与限流风险  
3. **缓存：** 复用「cache-first」思路（类似现有 `vin-cache`），**单独命名空间**，勿与 QXB cache 混写

### 不推荐作 APSales 主路径

| 方案 | 原因 |
|------|------|
| 自研 VIN 算法 | 任务禁止；易错 |
| 直连汽修宝做销售回复 | CEO 禁止；配额/职责混乱 |
| `half-cut-vin.js` WMI 猜测 | 仅 UI 兜底，不可当销售事实 |
| 仅 Dart/Go 库 | 与现有 Node/Python 栈摩擦大 |

---

## 5. 字段期望（全球基线能拿到什么）

典型 NHTSA / corgi 输出（名称因实现而异）：

| 字段 | 销售是否够用 |
|------|----------------|
| Make / Brand | ✅ |
| Model | ✅ |
| Model Year | ✅ |
| Manufacturer / Plant / Country | ✅ 辅助 |
| Engine Model / Displacement / Cylinders / Fuel | ⚠️ 常有；**精确发动机厂牌代码（如 G4KD）不一定有** |
| Transmission | ⚠️ 有时有 |
| Body / Drive | 辅助 |

**重要：** 即使 decode 成功，**发动机精确件号** 仍可能缺失 → Sales Decision 仍可问「long block / complete / 是否要变速箱」，但**不应再问已知的品牌/年款/车型**。

---

## 6. 与现有 `/api/vin/decode` 的关系

| | 库存 `/api/vin/decode` | APSales Customer Intelligence |
|--|------------------------|-------------------------------|
| 用户 | 供应商 / QXB 管线 / 子龙 | 全球买家 WhatsApp/邮件 |
| Provider | QXB | NHTSA / corgi（Phase 1） |
| 接口形态 | 可保留 | **统一 `VehicleSnapshot` 形状**，Provider 可插拔 |
| 本阶段 | 不动 | 只设计，不实现 |

---

## 7. 调研结论表

| 问题 | 答案 |
|------|------|
| GitHub 成熟方案？ | corgi、nhtsa-vin-decoder、官方 vPIC、vin-go 等 |
| 商业 License？ | MIT/ISC/Apache + 政府数据 → 可用 |
| 美/欧/日/韩？ | 美最强；日韩出口车较好；欧中等；中国弱 |
| AsiaPower 基线？ | **NHTSA API ± corgi**；QXB 留给子龙 |
| 自研算法？ | **禁止** |
