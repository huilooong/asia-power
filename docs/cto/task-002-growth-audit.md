# TASK-002 Growth Audit — AsiaPower Website

只读审计。未修改代码、未新增文件、未整理仓库。

依据：当前仓库页面、`reports/asia-power-traffic-report-2026-07-04.md`、`analytics-top-pages.csv`、`morning-engine-demand-2026-07-04.md`、库存 JSON、品牌/车型字典、现有 sitemap/SEO 文件。

## 1. 最大 SEO 短板

最大短板：**网站已有大量真实库存和买家需求，但没有把它们沉淀成可索引、可排名的搜索意图 Landing Page。**

证据：

- 库存基础很强：本地统计约 `831` 条库存/导入记录，Top 品牌是 Honda、Hyundai、Toyota、Nissan、Kia。
- 但可索引深度弱：现有独立发动机页只有约 12 个，品牌页多但内容偏泛。
- 流量集中：首页 `3854 PV`、`/half-cuts/ 1320 PV`，详情页和长尾页承接不足。
- 现有 sitemap 写了 `/guides/`、`/guides/buying-used-engines-from-china.html`、`/guides/fob-vs-cif-shipping-guide.html`，analytics 也有访问，但当前仓库浅层未见真实 `guides/` 页面文件，属于高 ROI 缺口。
- 买家实际搜索/询盘已有信号：`4JB1`、`G4KJ`、`2AZ-FE`、`1NZ-FE`、`1GR`、`HR15DE`、truck、Ghana、Nigeria、Algeria、Togo。
- 首页 H1 是 `Export Parts & Vehicles`，没有直接命中核心搜索词如 `used engines export China`、`half cut cars from China`、`truck cabs export`。

结论：现在不是缺库存，也不是缺页面数量，而是缺 **“库存 × 型号 × 发动机码 × 国家/港口 × 采购场景”** 的 SEO 页面体系。

---

## 2. 最值得新增的 50 个 Landing Page（按 ROI）

排序逻辑：已有库存数量 + 已有流量/询盘 + 西非/非洲采购意图 + 页面可复用性。

| ROI | Landing Page | Target keyword / 意图 | 为什么优先 |
|---:|---|---|---|
| 1 | `/half-cuts/export-to-ghana/` | half cut shipping to Ghana | 加纳有办公室、询盘和 WhatsApp 需求 |
| 2 | `/half-cuts/export-to-nigeria/` | half cut import Nigeria | 西非核心市场，Tokunbo 强相关 |
| 3 | `/engines/hyundai-g4fc/` | Hyundai G4FC engine | 库存 engineCode Top 1，80 条 |
| 4 | `/engines/honda-r20a3/` | Honda R20A3 engine | 66 条，CR-V/Accord 强需求 |
| 5 | `/engines/toyota-1zr-fe/` | Toyota 1ZR-FE engine | 56 条，Corolla/Vios 高库存 |
| 6 | `/engines/hyundai-g4na/` | Hyundai G4NA engine | 54 条，ix35/Tucson/Sonata |
| 7 | `/engines/nissan-hr16de/` 强化页 | Nissan HR16DE engine | 已有页但库存/流量强，应升级 |
| 8 | `/half-cuts/honda-cr-v/` | Honda CR-V half cut | 43 条车型库存，详情页已有流量 |
| 9 | `/half-cuts/honda-accord/` | Honda Accord half cut | 69 条，库存第一车型 |
| 10 | `/half-cuts/toyota-corolla/` | Toyota Corolla half cut | 63 条，非洲强需求车型 |
| 11 | `/half-cuts/hyundai-ix35/` | Hyundai ix35 half cut | 23 条，G4KD/G4NA 相关 |
| 12 | `/engines/honda-k24a8/` | Honda K24A8 engine | 29 条，Accord 热门 |
| 13 | `/engines/hyundai-g4gc/` | Hyundai G4GC engine | 25 条，Tucson/Sonata |
| 14 | `/engines/toyota-1az-fe/` | Toyota 1AZ-FE engine | 24 条，Camry/Corolla |
| 15 | `/engines/toyota-2az-fe/` | Toyota 2AZ-FE engine | 24 条，站内已有搜索 |
| 16 | `/engines/nissan-mr20de/` | Nissan MR20DE engine | 22 条，Qashqai/Teana |
| 17 | `/engines/mercedes-651-955/` | Mercedes OM651 engine | 18+9 条，Sprinter/E/B/V |
| 18 | `/engines/honda-r18a2/` | Honda R18A2 engine | 16 条，Civic |
| 19 | `/engines/hyundai-g4ke/` | Hyundai G4KE engine | 14 条，Ghana 询盘出现 |
| 20 | `/engines/honda-l13z/` | Honda L13Z engine | 13 条，Fit |
| 21 | `/half-cuts/nissan-sylphy/` | Nissan Sylphy half cut | 16 条，HR16DE |
| 22 | `/half-cuts/nissan-versa-tiida/` | Nissan Tiida / Versa half cut | 现有 HC250513 流量强 |
| 23 | `/half-cuts/nissan-qashqai/` | Nissan Qashqai half cut | 16 条，MR20DE |
| 24 | `/half-cuts/hyundai-tucson/` | Hyundai Tucson half cut | 21 条 |
| 25 | `/half-cuts/hyundai-sonata/` | Hyundai Sonata half cut | 20 条 |
| 26 | `/half-cuts/kia-k2/` | Kia K2 half cut | 17 条，G4FC |
| 27 | `/half-cuts/kia-forte/` | Kia Forte engine half cut | 12 条 |
| 28 | `/half-cuts/kia-soul/` | Kia Soul half cut | 11 条 |
| 29 | `/half-cuts/toyota-vios/` | Toyota Vios half cut | 14 条，HC250509 需承接 |
| 30 | `/half-cuts/toyota-rav4/` | Toyota RAV4 half cut | 13 条，2AZ/1AZ |
| 31 | `/half-cuts/toyota-camry/` | Toyota Camry half cut | 已有详情流量和询盘 |
| 32 | `/trucks/isuzu-4jb1/` | Isuzu 4JB1 engine / cab | 站内搜索 4JB1，详情流量 |
| 33 | `/trucks/isuzu-npr-100p/` | Isuzu NPR / 100P cab | 现有库存/详情流量 |
| 34 | `/trucks/hino-700-cab/` | Hino 700 truck cab | 现有详情流量 |
| 35 | `/trucks/howo-cab/` | HOWO truck cab export | 西非重卡市场 |
| 36 | `/trucks/shacman-cab/` | Shacman truck cab export | 库存有 Shacman |
| 37 | `/truck-heads/` 修复/强化 | truck head export China | sitemap 已有但页面覆盖不清 |
| 38 | `/front-cuts/toyota/` | Toyota front cut | 前切品类 PV 低但可扩 |
| 39 | `/gearboxes/toyota/` | Toyota gearbox export | 长尾采购 |
| 40 | `/gearboxes/hyundai-kia/` | Hyundai Kia gearbox | 与 G4FC/G4NA 匹配 |
| 41 | `/machinery/export-to-africa/` | used machinery export Africa | 现有 machinery 页面有基础 |
| 42 | `/machinery/cat-komatsu-parts/` | excavator parts China export | 工程机械长尾 |
| 43 | `/shipping/cif-to-tema-ghana/` | CIF Tema engine shipping | 现有 CIF 逻辑，应 SEO 化 |
| 44 | `/shipping/cif-to-lagos-nigeria/` | CIF Lagos auto parts | 西非高意图 |
| 45 | `/shipping/exw-vs-cif-auto-parts/` | EXW vs CIF auto parts | guides 已有流量信号 |
| 46 | `/importers/ghana-auto-parts/` | auto parts importer Ghana | Maps/客户开发支持 |
| 47 | `/importers/nigeria-tokunbo-parts/` | Tokunbo parts supplier China | 运营 playbook 明确 |
| 48 | `/engines/g4kj/` | G4KJ engine | WhatsApp/站内需求出现，当前页面缺 |
| 49 | `/engines/toyota-1gr-fe/` | Toyota 1GR engine | contact 查询出现 |
| 50 | `/engines/lexus-lx570-3ur/` | Lexus LX570 engine | 网站线索和详情页出现 |

---

## 3. 最值得写的 100 个博客主题（按搜索价值）

1. How to buy used engines from China safely
2. FOB vs CIF for auto parts importers
3. EXW China vs CIF Tema: which is better for Ghana buyers?
4. How to import half cuts from China to Ghana
5. How to import half cuts from China to Nigeria
6. What is a half cut car?
7. Half cut vs used engine: which should importers choose?
8. How to verify engine codes before importing
9. Toyota 1NZ-FE buying guide
10. Toyota 2NZ-FE buying guide
11. Toyota 1ZR-FE buying guide
12. Toyota 2ZR-FE buying guide
13. Toyota 1AZ-FE vs 2AZ-FE
14. Toyota 2AZ-FE common applications
15. Toyota 1KD-FTV import guide
16. Toyota 2KD-FTV import guide
17. Toyota 2TR-FE import guide
18. Toyota 1GR-FE engine import guide
19. Toyota Corolla half cut buyer guide
20. Toyota Vios half cut buyer guide
21. Toyota Camry half cut buyer guide
22. Toyota RAV4 half cut buyer guide
23. Toyota Hilux engine sourcing guide
24. Toyota Prado engine sourcing guide
25. Nissan HR16DE buying guide
26. Nissan HR15DE buying guide
27. Nissan MR20DE buying guide
28. Nissan QR25DE buying guide
29. Nissan Tiida half cut buyer guide
30. Nissan Sylphy half cut buyer guide
31. Nissan Qashqai half cut buyer guide
32. Nissan X-Trail engine import guide
33. Honda R20A3 buying guide
34. Honda K24A buying guide
35. Honda K24A8 buying guide
36. Honda R18A engine guide
37. Honda L13Z engine guide
38. Honda Accord half cut buyer guide
39. Honda CR-V half cut buyer guide
40. Honda Civic half cut buyer guide
41. Honda Fit half cut buyer guide
42. Hyundai G4FC buying guide
43. Hyundai G4NA buying guide
44. Hyundai G4KD buying guide
45. Hyundai G4KE buying guide
46. Hyundai G4GC buying guide
47. Hyundai ix35 half cut buyer guide
48. Hyundai Tucson half cut buyer guide
49. Hyundai Sonata half cut buyer guide
50. Hyundai Elantra engine guide
51. Kia G4FC engine guide
52. Kia K2 half cut buyer guide
53. Kia Forte half cut buyer guide
54. Kia Soul half cut buyer guide
55. Kia Sportage engine guide
56. Mercedes OM651 / 651.955 buying guide
57. Mercedes Sprinter engine import guide
58. Mercedes E-Class half cut buyer guide
59. Mercedes V-Class parts import guide
60. BMW N46 engine import guide
61. Audi EA211 engine guide
62. Volkswagen EA engine import guide
63. Isuzu 4JB1 engine buying guide
64. Isuzu NPR / 100P cab import guide
65. Isuzu Giga truck cab import guide
66. Hino 700 cab import guide
67. HOWO truck cab import guide
68. Shacman truck cab import guide
69. JAC Shuailing truck parts guide
70. FAW J6P cab import guide
71. Used truck heads from China: buyer checklist
72. Truck cab vs truck half cut: what to buy?
73. How to ship engines to Tema port
74. How to ship auto parts to Lagos
75. How to ship half cuts to Cotonou
76. How to ship engines to Abidjan
77. How to ship auto parts to Douala
78. How to ship engines to Mombasa
79. Ghana auto parts importer checklist
80. Nigeria Tokunbo parts importer checklist
81. Algeria auto spare parts importer guide
82. Togo engine importer guide
83. Cameroon spare parts importer guide
84. Benin auto parts sourcing guide
85. How to avoid wrong engine code orders
86. What photos should a supplier provide before shipment?
87. Why chassis/VIN photos matter in used parts import
88. How to read a half cut listing
89. What does “complete with accessories” mean?
90. Engine assembly vs half cut: difference
91. Used gearbox buying checklist
92. Automatic vs manual transmission import checklist
93. How to request CIF quote for engine shipment
94. How to compare China supplier quotes
95. How to inspect startup videos before buying
96. Common mistakes first-time engine importers make
97. How AsiaPower verifies supplier inventory
98. How to source custom dismantling parts from China
99. Best fast-moving engine codes for West Africa
100. Weekly Africa engine demand watch: Ghana and Nigeria

---

## 4. 应优先改版的页面

P0：

- `/half-cuts/`：流量第二高，但列表到详情深点不足。需要按品牌、发动机码、国家/港口、热门库存组织入口。
- `/engines/`：375 PV，需求明确，但现有 engine code 页面太少。首页级目录要变成“发动机码索引”。
- `/trucks/`：448 PV，高于 engines，说明 truck 不是边缘品类。应强化 truck cab / truck half cut / Isuzu / HOWO / Hino。
- `/contact.html`：214 PV，但 H1 抽取为空；这是转化页，必须改成强 CTA 和询盘分流。
- `/guides/`：已有 sitemap 和 analytics 信号，但当前仓库未见真实页面。应立即补齐或修复。
- 首页 `/`：H1 太泛，应该直接承接 `Used Engines, Half Cuts & Truck Cabs Export from China` 这类主关键词。

P1：

- `/brands/toyota.html`
- `/brands/hyundai.html`
- `/brands/honda.html`
- `/brands/nissan.html`
- `/brands/kia.html`
- `/gearboxes/`
- `/machinery/`
- `/front-cuts/`
- `/chassis-parts/`

P2：

- 低流量品牌页批量补内链，不优先重写。
- `supplier-portal.html` 要和买家流量隔离，避免 SEO/CTA 混乱。
- `offline.html`、`app.html` 有流量但不是增长页，暂不投入内容。

---

## 5. 30 天自然流量和询盘最大化计划（无广告预算）

第 1 周：修漏斗和可索引基础

- 修复/补齐 `/guides/`、`buying-used-engines-from-china.html`、`fob-vs-cif-shipping-guide.html`。
- 首页 H1/首屏改为 engines / half cuts / truck cabs export from China。
- `/contact.html` 补明确 H1、国家、产品、WhatsApp、email、CIF/EXW 表单路径。
- `/half-cuts/` 增加热门入口：Toyota、Honda、Hyundai、Nissan、Kia、Truck、4JB1、G4NA、HR16DE。
- sitemap 确认收录真实存在页面，不要保留不存在 URL。
- 所有 P0 页面加面包屑和强内链：Home → Category → Brand/Engine → Contact。

第 2 周：做 20 个高 ROI Landing Page

优先上线：

- 5 个国家/港口页：Ghana、Nigeria、Tema、Lagos、Cotonou。
- 10 个 engine code 页：G4FC、R20A3、1ZR-FE、G4NA、HR16DE、K24A8、1AZ-FE、2AZ-FE、MR20DE、G4KE。
- 5 个车型页：Honda Accord、Honda CR-V、Toyota Corolla、Hyundai ix35、Nissan Tiida/Versa。

第 3 周：内容集群和内链

- 发布 30 篇博客中的前 20 篇，围绕 import / engine code / shipping / Ghana / Nigeria。
- 每篇博客必须链接到对应 engine page、half-cut page、contact page。
- 每个 engine page 增加 “Applications / Stock examples / Shipping to Africa / Request quote”。
- 每个品牌页改成索引页：Top engines、Top half cuts、Available models、Buyer guide。

第 4 周：询盘转化优化

- 半切详情页强化 WhatsApp 和 email CTA，不只展示库存。
- 对 Top 30 详情页加 “CIF to Tema/Lagos estimate” 入口。
- 对 `/half-cuts/?cat=trucks`、`/trucks/` 做卡车专属询盘 CTA。
- 将现有 29 条网站线索反推：哪些入口产生有效线索，就把这些入口放进首页和目录页。
- 每周输出一次 analytics：新增页面 PV、详情点击、WhatsApp、表单线索、搜索词。

30 天目标：

- 自然/外部 PV 从约 6,548/15 天提升到 15,000+/30 天。
- 半切列表到详情点击率从约 36% 提升到 45%。
- WhatsApp 点击恢复到 10+/天。
- 表单线索从 29/15 天提升到 80+/30 天。
- 至少 50 个新 URL 可被 sitemap 收录。

## 6. Growth Lead 结论

AsiaPower 当前最有增长价值的不是继续做泛品牌页，而是把已有库存和真实需求变成 SEO 资产。

优先级应该是：

1. `Engine code pages`
2. `Model half-cut pages`
3. `Country / port import pages`
4. `Shipping / buyer guides`
5. `Brand pages enrichment`

不要先写泛泛的公司新闻。每一篇内容都必须服务一个搜索意图，并把用户导向 `/half-cuts/`、`/engines/` 或 `/contact.html`。
