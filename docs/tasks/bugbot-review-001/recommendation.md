# Recommendation — 修 / 不修 / 部分修 / 误判

**原则：** 先确认，再动手。本文件是确认结论；**尚未开始真正修复。**

---

## 总表

| ID | 分类 | 建议 | 一句话原因 |
|----|------|------|------------|
| High-1 | **应该修** | 接 live 库存（保留 seed 降级） | 产品目标是在库品牌目录，现网 53 品牌 vs seed 9 |
| High-2 | **需要部分修 / 先定产品优先级** | 不要整页盲目改 contain | cover 是后写 chrome 故意设计；与早期配件预览冲突 |
| Medium-1 | **应该修** | 把 `·` 改成合法 UTF-8 | 编码损坏，证据确凿 |
| Medium-2 | **保持现状**（Bugbot 定性偏误） | 不删、不改 symlink | 是 APBRAIN 故意 symlink，非误提交文档 |

---

## 哪些应该修？

1. **High-1（品牌页）** — 对齐「in-stock / dynamic」承诺；推荐 **seed 首屏 + inventory-store hydrate + 就绪后重绘**，不要裸删 seed。
2. **Medium-1（SVG）** — 低风险文案修复。

## 哪些应该保持现状？

1. **Medium-2（AsiaPower-Brain）** — 保持 symlink；若要改善可移植性，另开 APBRAIN 任务，不要当 Bugbot 清理项。
2. **High-2 的「半切 / Banner / 品牌图 / 占位图用 cover」** — 保持。

## 哪些需要部分修？

1. **High-2** — 仅当 CEO 仍优先「专用配件图完整显示」时：
   - **部分修**：只让「带真图的 `ap-listing-photo--fit-contain`」在 parts 四页用 contain；
   - **不要**改半切列表、banner、品牌卡、占位 `--parts-ph`；
   - 接受可能轻微行高差异，或在预览里再验一次再上生产。
   - 若 CEO 优先「列表绝对整齐」→ **不修 CSS**，只改 JS 注释消歧，避免后人当 bug 再改回去。

## 哪些属于 Bugbot 误判？

| 项 | 误判程度 | 说明 |
|----|----------|------|
| Medium-2 | **定性误判 / 缺上下文** | 当成「提交了绝对路径文本」；实际是 **故意 symlink** |
| High-2 | **不完全是误判** | CSS 覆盖事实对，但标成单纯 bug 忽略了 Jul 11 故意统一 cover |
| High-1 | **基本非误判** | 缺 fallback 完整叙述，结论方向对 |
| Medium-1 | **无误判** | |

---

## 建议修复顺序（待 CEO 点头后）

1. Medium-1 SVG（可单独小改）
2. High-1 brands hydrate（需验证证据：品牌数、API 失败降级）
3. High-2 等 CEO 选「完整显示 vs 行高整齐」后再动
4. Medium-2 不纳入本任务

## Explicit non-actions（本确认阶段）

- 不改业务代码
- 不部署
- 不删除 `AsiaPower-Brain`
- 不 rerun Bugbot 自动「全修」
