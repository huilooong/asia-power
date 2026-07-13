# APMAIL-001 Test Results

## 命令

```bash
cd /Users/longhui/Desktop/AsiaPower
node --test tests/test_email_mime_parse.js tests/test_email_proxy.js
.venv/bin/python3 -m unittest tests.test_email_text_normalize -v
```

## 结果（本次执行）

### Node

```
tests 17
pass 17
fail 0
```

覆盖：

- quoted-printable 软换行（含任务样例空格形式）
- quoted-printable 中文 UTF-8
- base64 正文
- HTML-only
- multipart/alternative
- multipart/mixed 附件元数据
- Gmail 风格字段路径（无 raw）
- Outlook 风格 HTML multipart
- ISO-8859-1 / Windows-1252
- 正文合法 `=`
- ingestInbound 规范化
- rawBase64 → mailparser 权威路径

### Python

```
Ran 10 tests in 0.006s
OK
```

覆盖：

- 任务乱码样例
- QP 中文
- base64 / GBK
- HTML-only
- multipart/alternative
- multipart/mixed 附件
- `latest_inbound_text` 强制清洗

## 验证点核对

| 要求 | 结果 |
|------|------|
| 不再出现软换行多余 `=` | 通过 |
| 中文不乱码 | 通过（UTF-8 QP + GBK MIME） |
| HTML → 可读纯文本 | 通过 |
| 附件元数据保留 | 通过 |
| 正常邮件不破坏（合法 `=`） | 通过 |

## 未做

- 未发送真实外部邮件
- 未读取/修改用户真实邮箱
- 未部署生产 Worker / Node（见 review.md）
