# APBD + 管理后台推广页整合预览

状态：本地预览，等待 CEO 界面确认；未修改生产后台页面，未部署。

## 交付目的

把抖音视频中的“一人外贸工作台”链路与 AsiaPower 原有 APBD 合并，并明确 APBD 与 APSales 的边界：

1. APBD 使用 Google Places 和公开官网发现、去重、研究公司。
2. Hunter 只对有效企业域名按需补全，不处理 Instagram、WhatsApp 短链或缺失官网的候选。
3. 公司实体写回原 APBD 客户库；活动文件只保存本次评分、草稿与审批流程。
4. Hunter 查到邮箱后仍要验证，有效邮箱也不等于采购意向。
5. 评分通过、草稿完成和外发授权保持独立；本次没有发送任何邮件。
6. 线索形成真实询价或商机后交给 APSales。

## 本次真实试跑

- Google Places：10 条查询、30 条原始结果、去重 14 条、新增 16 家、0 个 API 错误。
- 原公开网页候选：7 家。
- 合并后：23 家全部关联原 APBD 客户实体。
- 评分：2 家 C、21 家 D、0 家 A/B；当前外发候选为 0。
- Hunter：测试 8 个企业域名，3 个有结果；找到 11 个通用邮箱，相对原数据新增 8 个。
- 邮箱验证：8 个 valid、2 个 invalid、1 个 unknown；没有具名采购联系人。
- Hunter 账户：Free，当前统一额度剩余 42/50。
- 异常：第一次长验证超时后发生重试，Hunter 记录 16 次验证请求，而唯一邮箱只有 11 个。已改为逐条落盘和断点续跑。

## 文件

```text
docs/previews/apbd-solo-trade-002/
├── README.md
├── app.js
├── sample-campaign.json
├── solo-trade-preview.html
├── styles.css
└── validation-report.md
```

`sample-campaign.json` 只保留公司、公开来源和聚合后的 Hunter 数量，不包含 Hunter 返回的邮箱地址或密钥。

## 本地预览

从本目录启动静态服务后打开：

```text
http://127.0.0.1:8765/solo-trade-preview.html
```

## 上线前仍需完成

1. CEO 确认本预览的后台信息架构与文案。
2. 将 APBD 标签嵌入 `admin/apsales-progress.html`，保留原 APSales 动作日志标签。
3. 增加仅管理员可访问的 APBD 读取接口；任何会调用 Places/Hunter 的动作还需单独的服务端开关和限流。
4. 使用 Release Manager 的 `admin` 与 `api` 目标发布，并验证登录、移动端、额度保护和回滚。
