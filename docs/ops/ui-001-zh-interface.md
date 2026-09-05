# UI-001 简体中文界面

**Status:** 代码已改，预览待 CEO 确认后才能上生产  
**Date:** 2026-09-05

## 结论

官网第一次打开改为**简体中文**。登录页、采购商工作台、询价收件箱筛选也改成中文。海外买家仍可点右上角 **EN / FR / AR**。

## Deliverables

| 文件 | 作用 |
|---|---|
| `docs/previews/zh-ui-default/zh-ui-preview.html` | CEO 预览（未上线） |
| `js/public-i18n.js` | 默认语言 `zh`；支持 `?lang=` |
| `login/index.html`、`buyer-portal/`、管理端文案 | 去掉中英混排，改简体中文 |

## Paths

- 相对：`docs/previews/zh-ui-default/zh-ui-preview.html`
- 绝对：`/workspace/docs/previews/zh-ui-default/zh-ui-preview.html`

```
docs/previews/zh-ui-default/
└── zh-ui-preview.html
```

Preview URL（仓库内打开）：`docs/previews/zh-ui-default/zh-ui-preview.html`

## 怎么用（给 CEO）

1. 打开预览页看中文长什么样。
2. 确认后走正式上线流程（commit → GitHub → Release Manager）。**这次没有部署生产。**
3. 如果浏览器以前点过 EN，右上角再点一次「中文」。
4. 也可在网址后面加 `?lang=zh` 强制中文。

## Validation

见 `scripts/test-public-i18n-default-zh.cjs` 输出。

## Next Task

CEO 批准预览后，用 Release Manager 部署。不要用 `--allow-dirty`。
