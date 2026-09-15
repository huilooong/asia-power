# 发布前验证

- 用户已明确选择“按文件合并恢复新版”，本次恢复既有已批准界面，不进行新设计。
- 独立分支 codex/restore-public-site-20260915，工作目录 /Users/longhui/Desktop/AsiaPower-restore-public-site-20260915。
- 307 个文件：88 个恢复/合并文件；219 个页面仅更新共享资源缓存版本。排除历史 docs/backups、Users 和 .claude/worktrees 路径副本。
- 219 个缓存页面与生产基线逐字比较（仅剥离 ?v= 参数）完全一致；保留当前后台页面内容。
- 恢复来源：覆盖前生产快照优先；无快照的品牌/国家/应用页面匹配 9 月 10 日发布清单 SHA-256；其余脚本取对应 Git 版本。
- 分类修复通过三方合并保留。冲突人工合并保留腾势/方程豹品牌识别、专用零件与轮胎规则，并保留 JAC、Volvo、Hyundai、Changan 商用分类规则。
- 首页契约/多语言测试 6/6 通过；所有清单 JS 语法通过。
- 浏览器：1440、768、390px；EN/ZH/FR/AR，零页面异常，无横向溢出；手机菜单开合正常。
- 使用真实公开库存测试：JAC HC250613 为 passenger/engine；XC60 HC250581 为 passenger 且 Reserved，属于半切，不属于货车。默认 Available 筛选不显示已预留 XC60；精确库存号搜索原设计跨分类搜索，不改变该行为。
- 发动机页面可以检索到 HC250613；Audi 指南筛选保留 91 guides / 24 shown，模型限定 Audi。
- 发布器安装测试 4/4：基线漂移拒绝写入、校验安装、拒绝覆盖后续修改的回滚、按文件回滚。
- 已知既有测试失败：test_cache_bust_check.mjs 的 current-tree 全库断言在原始 3339ffff3 分支也失败（components.js 10 个版本 / config.js 3 个版本）。恢复分支为 components.js 2 个版本 / config.js 3 个版本；不为通过该旧断言修改未发布页面或 config.js。此次生产引用以限定 manifest 和实际生产页面逐项校验。
- 预览 http://127.0.0.1:8877/；截图保存在 screenshots/（本机证据，不提交）。
- 生产发布通过 Release Manager；全量备份、307 文件快照、逐文件基线比对、安装后哈希、可回滚记录。后端服务不重启。
