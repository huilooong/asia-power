# AsiaPower · 混合预览（v4 门面 + 现网多品类货架）

**Task:** `v4-hybrid`  
**Date:** 2026-07-09  
**Status:** ✅ Preview ready（未上线）

## 结论

按 CEO 确认路线渲染：**v4 品牌门面 + 现网五品类货架**。

| 区块 | 来源 |
|------|------|
| Hero 大标题 + 居中搜索 | v4 |
| 数据条 / 分类入口 / Featured | v4 |
| Half-Cuts / Engines / Trucks / Machinery / Used Cars 横向货架 | 现网库存逻辑 |
| 数量与图价 | asia-power.com 实时快照 |

## 预览

http://127.0.0.1:8791/docs/previews/v4-hybrid/

对照：

- 上一版（仅半切网格）：http://127.0.0.1:8791/docs/previews/v4-live/
- 现网：https://asia-power.com/

## 文件

```
docs/previews/v4-hybrid/
├── index.html
├── hybrid.css
├── hybrid.js
├── inventory-snapshot.json
└── README.md
```

## 下一步

CEO 确认本预览方向后，再进入正式落地（改生产 `index.html`，走 Release Manager）。**当前未上线。**
