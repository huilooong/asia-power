# APCONTACT-001 — Migration Report

## 做了什么

1. 审计全库公司 WhatsApp 入口（`wa.me` / 显示号 / JSON-LD / 签名 / 脚本文案）  
2. 将默认入口统一为 **`+86 166 3880 1930`** / `https://wa.me/8616638801930`  
3. 同步：`js/config.js`、公开页硬编码、邮件签名、社交回复文案、生成器脚本  
4. 资产扫描：常见 PNG/JPG/SVG/PDF **未发现**内嵌旧公司号码二维码文本  
5. 历史 evidence / 任务文档 **未改**（保留为记录）

## 关键文件类型

| 类型 | 示例 |
|------|------|
| 配置 | `js/config.js` |
| 公开页 | `index.html` `contact.html` `about.html` `engines/*` `half-cuts/` `trucks/` 等 |
| JS CTA | `js/home-v4-hybrid.js` `js/inquiry-cta.js` `js/main.js` `js/components.js`（经 config） |
| 签名/自动消息 | `sales_core/email_signature.py` `sales_core/apsales_handler.py` `scripts/apsales-social-reply-watch.py` |
| 预览 | `docs/previews/v4-*` 等 |
| 文档 | `README.md` `TOOLS.md` |

完整列表见 `changed-files.txt`（约 136 个文件，不含并行中的 APWA nightshift 代码改动）。

## 验证

| 检查 | 结果 |
|------|------|
| 公开 HTML/JS 中 `wa.me` 仅 `8616638801930` | ✅（抽样：首页/engines/contact） |
| 旧 `233540911111` / `8618603773077` 在迁移面 | ✅ 清零 |
| 邮件签名含 `+86 166 3880 1930` | ✅ unittest PASS |
| 图片/SVG 内嵌旧号 | ✅ 未发现 |
| 生产已上线 | ❌ 尚未部署 |

## 部署提醒

客户看到的仍是现网旧号，直到走：

`commit → push GitHub → scripts/deploy-production.mjs`
