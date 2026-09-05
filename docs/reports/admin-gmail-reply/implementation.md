# 询价收件箱 Gmail 回复入口

在有有效邮箱的客户卡片中新增“Gmail 回复”；包括已回复客户的继续跟进。点击新标签打开销售账号 sales@asia-power.com 的 Gmail 撰写界面，带入客户邮箱和建议回复主题。正文由操作者编辑，不带入内部IP、来源统计或自动发送。不自动改变询价回复状态。

无有效邮箱不显示该入口；原有邮箱客户端、WhatsApp及标记回复功能保留。网站表单没有Gmail原线程ID，因此此入口为撰写回复，不承诺定位原邮件线程。

生产修改仅 js/admin-leads.js 与 admin/leads.html；版本更新防止旧缓存。采用 Release Manager 的 admin-gmail 限定目标，生产文件哈希、备份、快照及验证，不重启服务。回滚使用该发布的 release.json 恢复两文件。

输出：docs/reports/admin-gmail-reply/；绝对路径 /Users/longhui/Desktop/AsiaPower/docs/reports/admin-gmail-reply/。
预览：docs/previews/admin-gmail-reply/index.html；http://127.0.0.1:8765/docs/previews/admin-gmail-reply/index.html（仅示例数据）。
测试：3项Gmail链接/邮箱校验/回复状态测试；后台脚本检查通过。具体线上发布结果另附release.json。

浏览器已实测点击示例按钮：Gmail打开 sales@asia-power.com 的撰写窗口，收件人为 buyer@example.com，主题 Re: G4KD enquiry，正文为空。本次示例草稿已丢弃，未发送邮件。
