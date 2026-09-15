# 网站新版按文件合并恢复

## 状态：Completed

2026-09-15 已恢复 asia-power.com 的已批准新版首页及公共页面，同时保留 JAC S3、Volvo XC60 与商用车分类修复。

- Release ID：`REL-20260915212032-site-restore-10493586b`
- 发布提交：`10493586bc77ae89d603305b6f2e8d355838bb47`
- 分支：`codex/restore-public-site-20260915`（已推送 GitHub）
- 生产地址：https://asia-power.com/
- 本机预览：http://127.0.0.1:8877/

## 交付范围

307 个生产文件：88 个恢复/合并文件，219 个页面只更新共享资源缓存版本号。历史备份、Users 路径副本和嵌套 .claude 工作区不在发布清单内。

恢复循环经济首页、图片 Logo、采购搜索、供应商入口、手机导航、四语内容、统一样式和 +86 16638801930 WhatsApp 入口；首页 AW-5641180568 配置恢复。广告实际归因和转化结果未在本次验证范围内。

以覆盖前生产快照和已发布 Git 版本为恢复依据，人工处理三方合并冲突，保留后来的有效分类逻辑。没有发布 API 或 APBD 代码，也没有恢复数据库或库存记录。

## 验证

- 307/307 文件通过安装前生产基线比对、上传内容哈希及安装后哈希检查。
- 219 个缓存页面与当前生产基线逐字比较，除版本参数外没有内容改变。
- 17/17 公网 JavaScript/CSS/Service Worker 哈希匹配。
- 公网首页、发动机、半切、品牌、发动机指南、公开库存接口检查通过；发布记录中 25 项通过、4 项通用目标检查不适用，由本次限定校验补充。
- 首页公网 SHA-256：`9bf51b0208ed950c5e7a5b29838149a4332363ec5bd544fa1cd3c56876a2af4e`，与发布源文件一致。
- 浏览器预览覆盖 1440、768、390px 和 EN/ZH/FR/AR；上线后再次验证桌面英文、手机中文/阿拉伯文、菜单开合、实时库存和 WhatsApp 地址，零页面异常、无横向溢出。
- 真实公开库存与浏览器分类：HC250613 = passenger/engine；HC250581 = passenger/half-cut，状态 Reserved；两者均不在货车分类池。原有精确库存号跨分类搜索行为保留。
- 首页测试 6/6；发布器安装/基线漂移/回滚保护测试 4/4；全部发布 JavaScript 语法检查通过。
- API server.js、apbd-admin.js、listing-category-corrections.js、nginx 配置前后哈希相同；服务启动时间、运行状态及重启计数相同。

### 已有检查限制

全库缓存统一性测试的 current-tree 断言在原始恢复基线分支也失败，涉及历史路径与未改动的 config.js；没有修改测试来隐藏失败。本次生产清单的版本引用和真实公网哈希单独通过。详见 `restore-public-site-20260915/validation.md`。

本次验证不能代表每位访客既有浏览器缓存均已更新，也不构成全站每一项业务流程的完整端到端测试。

## 发布安全与回滚

通过 Release Manager 创建完整备份及限定文件快照；安装器先检查所有生产基线，再写入文件。发现生产新增修改会停止。回滚也会拒绝覆盖发布之后的第三方更改。

备份：`/root/.openclaw/workspace/inventory-site/backups/scheduled/asia-power-backup-20260915-212034.tar.gz`

限定文件回滚命令（仅备查，本次没有执行）：

```sh
ssh root@159.65.86.24 python3 /root/.openclaw/workspace/inventory-site/releases/REL-20260915212032-site-restore-10493586b/install.py /root/.openclaw/workspace/inventory-site/releases/REL-20260915212032-site-restore-10493586b --restore
```

该命令只处理本发布清单，不恢复整站或数据库。

## 输出位置

- 工作目录：`/Users/longhui/Desktop/AsiaPower-restore-public-site-20260915`
- 报告相对路径：`docs/ops/ops-website-restoration-20260915.md`
- 绝对路径：`/Users/longhui/Desktop/AsiaPower-restore-public-site-20260915/docs/ops/ops-website-restoration-20260915.md`

```text
docs/ops/
├── ops-website-restoration-20260915.md
└── restore-public-site-20260915/
    ├── manifest.json
    ├── release.json
    ├── validation.md
    ├── browser-qa.json
    ├── classification-qa.json
    ├── production-browser-qa.json
    ├── production-classification-qa.json
    ├── protected-before.txt
    ├── protected-after.txt
    └── screenshots/（本机保存）
scripts/
├── deploy-site-restore.mjs
└── preview-site-restore.cjs
tests/
└── test_site_restore_installer.py
```

新增发布工具、验证工具和报告；生产修改明细全部列于 manifest.json。原 AsiaPower 工作区已有未提交修改未被变更。

后续建议：把此次生产基线冲突阻断复用到其他旧发布入口，防止其他分支再次整组覆盖；本次没有修改其他发布流程。
