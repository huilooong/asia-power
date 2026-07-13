# ChatGPT Export

## 目的

**不是**让 ChatGPT 直接读整个 Vault。  
**而是**：每天生成一份短摘要，CEO 上传给 ChatGPT，即可恢复长期上下文。

## 产物

路径：`AsiaPower-Brain/exports/chatgpt/brain-summary.md`

## 内容栏目（固定）

1. 今天新增决策  
2. 新增 Lesson  
3. 新增 Architecture  
4. 新增 Roadmap  
5. 新增 Vehicle Knowledge  
6. 新增 CEO Decision  
7. 新增 Risk  

## 字数

控制约 **1000–2000 字**（中文）。超了就压缩成要点，不要贴原文全文。

## 如何生成

```bash
# 在仓库根目录
python3 scripts/asiapower-brain-daily-export.py
# 或指定日期
python3 scripts/asiapower-brain-daily-export.py --date 2026-07-13
```

脚本只读 Brain 内 Markdown，写出 `brain-summary.md`。  
**不部署业务代码**；可本地手动跑，或以后接 cron / Cursor 自动化。

## 未来

若 ChatGPT 支持直连 Obsidian：本目录结构**无需重构**；Export 仍可作为轻量同步选项。

## 相关

- [[Home|Home]]
- 当前摘要：[[exports/chatgpt/brain-summary|brain-summary]]
