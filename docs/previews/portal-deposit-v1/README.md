# portal-deposit-v1 预览包

**状态：** 预览 · 未上线  
**范围：** 采购商轻量门户 + Stripe 定金示意 + 供应商注册/补资料/手机登录

## 打开方式

本地静态服务后访问：

- 总览：`docs/previews/portal-deposit-v1/`
- 采购商：`buyer-portal-preview.html`（验证码 `123456`）
- 供应商：`supplier-portal-preview.html`（手机 `16638801930`，验证码 `888888` → 先补资料再进工作台）
- 定金：`deposit-flow-preview.html`

示例：

```bash
cd /Users/longhui/Desktop/AsiaPower
python3 -m http.server 8791
# 打开 http://127.0.0.1:8791/docs/previews/portal-deposit-v1/
```

## 供应商规则

| 角色 | 规则 |
|------|------|
| 新供应商 | 必须注册并填写公司资料 |
| 老供应商 | 手机登录后，资料不全须先补全 |
| 必填 | 公司名称、业务类型、联系人、国家、邮箱、地址、主营品类 |

正式工作台：`/supplier-portal/dashboard.html`

## CEO 验收

| 角色 | 过关标准 |
|------|----------|
| 新供应商 | 不填资料无法注册成功 |
| 老供应商 | 登录后先补资料，再看「我的上传」 |
| 采购商 | 登录后看到订单，可点 Pay Deposit |
| 访客 | 仍可 WhatsApp / 询价 |
