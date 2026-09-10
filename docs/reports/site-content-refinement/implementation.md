# 本轮修改与验收

状态：本地修改，未部署。预览在 http://127.0.0.1:8875/ 。
分支：codex/site-content-refinement。独立工作目录：/Users/longhui/Desktop/AsiaPower-site-content-20260910 。

## 交付

- docs/reports/site-content-refinement/index.html：红框前后对比，图片可放大。
- index.html、css/home-v4-hybrid.css：首页入口、独立页脚、按钮与手机菜单。
- guides/index.html、engines/index.html：内容入口；通用目录连接全部 17 篇既有文章及发动机目录。
- js/components.js：已确认源照片在各组件的显示方向处理。
- js/ebay-layout.js、css/sitewide-secondary-v1.css：重复／缺失主标题及公共操作可读性。
- js/public-i18n.js、js/path-utils.js、contact.html：目录正文、联系标题、详情固定文本及语言资源版本。
- server/lib/sitemap.js：递归发现公开指南，规范目录 index 路径，去重，排除 noindex。
- guides/engines/：315 篇独立文章及索引；engine-guides-sitemap.xml：316 个网址。
- scripts/build-engine-guides.py：从有来源的应用数据生成文章。
- docs/reports/engine-guides-20260910/engine-verification.json：本轮文章应用记录与来源。
- scripts/preview-site-content.cjs：仅本机、只读预览服务；未调用部署或外部发送操作。

## 验证

56 组代表页面／宽度／语言组合检查通过，另对 17 篇既有指南及目录页的手机显示逐页复查，均保留一个可见主标题，无横向溢出。
315 篇文章的主标题、规范网址、目录链接、结构化数据和来源键检查通过。
主地图预览含 334 个指南网址，专用地图含 316 个网址。嵌套目录、去重、noindex 排除测试通过。
已实测图片切换至普通照片、再切回修正照片；缩略图随之正确呈现。
JS 语法检查通过。CSS 与语言资源的版本号已更新，以备审阅后的正式发布。

## 内容边界

新增 174 篇，奔驰合计 81 篇。此数是本轮有具体应用行支持的独立编码，不代表穷尽所有中国投放车型。
基础资料为 MANN 中国 2020 年目录，补充两个当前奔驰线上目录。日期为目录应用期，不自动解释为中国上市日期；未根据过滤器共用关系推断发动机可互换。
车型／编码混写、仅系列名、无法清楚对应的记录未直接生成新文章。其他品牌较新车型仍需补充独立证据。
发动机长文为英文；本轮多语言修复范围在对比页明示。既有指南标注正文原语言。

## 发布边界

尚未发布。本轮主工作目录中其他未提交改动保持原状；仅更正了此前检查报告关于专用站点地图的错误表述。
后续发布应使用 Release Manager，针对本轮文件生成生产基线校验与回滚清单；不要将工作目录整体同步到生产。
