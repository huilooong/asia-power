# OPS · 供应商注册「完成」无反馈

**状态：** 本地已修复 · **未上生产**（等 CEO 说可以上线）  
**日期：** 2026-07-12  
**任务 ID：** supplier-register-complete-feedback

---

## 结论

| 项 | 结果 |
|----|------|
| 根因 | 校验/错误几乎只靠右下角 toast；手机浏览器底栏易挡住；按钮旁 hint 不更新 → 感觉「点了没反应」 |
| 次要风险 | 提交中按钮 `disabled` 无文案；请求若挂起则一直点不动且无提示 |
| 修复 | 按钮下方即时红字提示 + toast 改顶部 + 提交中文案 + 20s 超时 + `finally` 恢复按钮 |
| 生产部署 | ⏸ 未部署 |

---

## 交付物

| 项 | 路径 |
|----|------|
| 登录页 | `login/index.html`（缓存 `reg-feedback-v1`） |
| 逻辑 | `js/login.js` |
| 样式 | `css/login.css` |
| 本报告 | `docs/ops/ops-supplier-register-complete-feedback.md` |
| 本地验证 URL | http://127.0.0.1:8787/login/?role=supplier&mode=register |

---

## 验证（本地 Puppeteer）

| 步骤 | 结果 |
|------|------|
| 未勾选条款点「完成注册」 | hint + toast 显示「请勾选同意供应商标准」 |
| 勾选后缺字段 | hint 列出缺少项 |
| 填齐提交 | 跳转 `/supplier-portal/dashboard.html` |

---

## 下一步

CEO 确认后走 Release Manager 部署（commit → push → deploy）；**不要** `--allow-dirty` 常态直推。
