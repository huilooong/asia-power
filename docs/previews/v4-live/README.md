# AsiaPower · v4 结构 + 现网库存预览

**Task:** `v4-live`  
**Date:** 2026-07-09  
**Status:** ✅ Preview ready（未上线）

## 结论

按 CEO 选定的 **v4 全站升级版** 版式，接入现网真实库存快照，做成可点预览。

| 项 | 内容 |
|----|------|
| 结构 | v4（居中 Hero + 搜索 + 分类 + Featured + 商品网格） |
| 数据 | `asia-power.com/api/half-cuts/public` 快照（496 台 Available） |
| Featured | HC250127 Lexus LX570（现网真实图/价） |
| 状态 | **仅预览**，未改生产首页 |

## 预览地址

http://127.0.0.1:8791/docs/previews/v4-live/

对照：

- 纯设计稿：http://127.0.0.1:8791/docs/previews/page-design-last2/asia-power-v4-upgraded.html
- 现网首页：https://asia-power.com/

## 文件

```
docs/previews/v4-live/
├── index.html
├── v4-live.css
├── v4-live.js
├── inventory-snapshot.json
└── README.md
```

## 下一步（需 CEO 确认）

1. 预览满意 → 再做正式落地（改 `index.html` + CSS，走 Release Manager）
2. 要改文案/模块顺序 → 先在本预览改，再上线
