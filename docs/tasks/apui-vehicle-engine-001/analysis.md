# APUI-VEHICLE-ENGINE-001 — Analysis

**Date:** 2026-07-13  
**Status:** Audit → Design → Preview（本阶段不 Commit / Push / Deploy）  
**CEO decision:** Half-Cut = Vehicle-first；Engine = Engine-first；两类页面不强制同一标题结构。

## Problem

当前半切与发动机卡片混用“车型 + 发动机”标题，搜索意图被模糊：

| 客户搜索 | 正确页面中心 | 现状风险 |
|----------|--------------|----------|
| Toyota Camry Half Cut | Vehicle | 标题偏发动机或年款堆叠 |
| 2AZ-FE Engine / Camry 2AZ Engine | Engine | 误写成唯一车型；兼容车型未结构化展示 |

## Product decision (locked)

### Half-Cut（Vehicle-first）

```
Vehicle Model
→ Engine Code · Displacement Fuel
→ Year / Year Range
→ Availability Status
```

### Engine（Engine-first）

```
Engine Code
→ Displacement + Fuel
→ Compatible Vehicles（应用摘要，非唯一车型）
→ 其它真实规格
```

## Scope (preview only this phase)

| In | Out |
|----|-----|
| Half-Cut cards / listing / detail IA | Commit / Push / Deploy |
| Engine cards / catalog / detail IA | 新建车型页 / 新 API / 新 Engine |
| Compatible Vehicles 展示策略 | 改 URL / sitemap / 库存业务逻辑 |
| SEO title/H1 规则设计 | APSales / Vehicle Intelligence 后端 |

## Key findings (from data-audit)

1. Half-Cut 库存主字段齐全的是 brand / model / year / engineCode / status；**displacement / fuel 多数靠 `ENGINE_DIRECTORY` 回填**。
2. Engine 静态目录 `js/engine-directory.js`：**105** 条均有 displacement、fuel、applications 文本。
3. Compatible Vehicles 今日 = 目录 `applications` 逗号字符串 + 生成页库存聚合 + 1 条知识库 JSON；**无统一 API**。
4. 目录内同代号不同排量/燃油冲突：**0**；近重复代号（HR16/HR16DE）与 config↔directory 分裂是主要数据风险。
5. `engines/index.html` 现网是库存拆件视图，不是纯静态目录卡——改造时需区分“目录意图”与“库存意图”。

## Next

CEO 审预览 → 批准后再进入实现与上线（不在本任务阶段）。
