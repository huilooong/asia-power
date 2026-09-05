# 询价收件箱 Gmail 回复入口

在有有效邮箱的客户卡片中新增“Gmail 回复”；包括已回复客户的继续跟进。点击新标签打开销售账号 sales@asia-power.com 的 Gmail 撰写界面，带入客户邮箱和建议回复主题。正文由操作者编辑，不带入内部IP、来源统计或自动发送。不自动改变询价回复状态。

无有效邮箱不显示该入口；原有邮箱客户端、WhatsApp及标记回复功能保留。网站表单没有Gmail原线程ID，因此此入口为撰写回复，不承诺定位原邮件线程。

生产修改仅 js/admin-leads.js 与 admin/leads.html；版本更新防止旧缓存。采用 Release Manager 的 admin-gmail 限定目标，生产文件哈希、备份、快照及验证，不重启服务。回滚使用该发布的 release.json 恢复两文件。

输出：docs/reports/admin-gmail-reply/；绝对路径 /Users/longhui/Desktop/AsiaPower/docs/reports/admin-gmail-reply/。
预览：docs/previews/admin-gmail-reply/index.html；http://127.0.0.1:8765/docs/previews/admin-gmail-reply/index.html（仅示例数据）。
测试：3项Gmail链接/邮箱校验/回复状态测试；后台脚本检查通过。具体线上发布结果另附release.json。

浏览器已实测点击示例按钮：Gmail打开 sales@asia-power.com 的撰写窗口，收件人为 buyer@example.com，主题 Re: G4KD enquiry，正文为空。本次示例草稿已丢弃，未发送邮件。

## 完成状态

已部署并验证通过：`REL-20260905003838-admin-gmail-7043b2efc`。提交 `7043b2efc6218915aab11f4be5d2d9af26e80eac`。两个线上文件SHA-256一致，49项发布依赖检查通过。实际已登录询价收件箱显示36张客户卡片，其中35张有Gmail入口；页面加载新版脚本。

文件树：implementation.md（说明）、release.json（备份、验证、回滚记录）。新增受控发布模块、验证脚本、3项测试和示例预览；仅两项前端生产文件发生变更，客户数据与回复状态未修改。后续：在询价卡片点击Gmail回复，编辑后手动发送。
