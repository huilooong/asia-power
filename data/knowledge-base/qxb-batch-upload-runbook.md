# 汽修宝 QXB 批量上传 — 运维经验存档

> 归档时间：2026-06-29  
> 用途：子龙/Codex 续跑批量上传、调限流、最后 reconcile  
> 相关代码：`inventory_core/qxb_pipeline.py` (v1.4+)、`scripts/qxb-batch-upload.py`、`scripts/qxb-batch-remaining.py`

---

## 1. 目标流程

```
inspect → pick → process --live → submit-review → CEO Admin 审核
```

- Admin 待审：`https://asia-power.com/admin/inventory.html?tab=pending`
- CLI 在 `python3 main.py` 的 `You>` 里用 `/qxb …`（不是 shell 的 `/qxb`）
- 单行：`python3 scripts/qxb-batch-upload.py 32 33 …`
- 全量剩余：`python3 scripts/qxb-batch-remaining.py --delay 12 --retry 4 --backoff 60`

**收尾必做：** `/qxb reconcile` → `reports/qxb-reconcile.json`，补漏提交（历史上 24/25/27 曾本地 pending 但服务器无记录）。

---

## 2. 核心原则（别踩坑）

| 原则 | 说明 |
|------|------|
| CEO 改图才训练子龙 | `trainingExemplars` / `recognitionModel` 只来自 CEO 核实；批量脚本**不得**用启发式写 exemplar |
| 批量不逐行确认 | 硬阻塞（无 VIN、decode 全失败）跳过；最后 reconcile |
| parked 自动跳过 | `count_remaining_upload_rows()` 跳过 `parked`；22 行暂缓 |
| VIN 严格化 | `normalize_vin_strict()`：O→0, I→1, Q→0（Admin 拒 I/O/Q） |
| decode 403/失败 | 走 `fallback_vin_decode` + trim 推断引擎/变速箱 |

---

## 3. 上传限流 — **423 Locked / 429 Too many**（不是 VIN decode）

日志里三类限流，均来自 **half-cut 上传/提交** 或 **nginx 前置限流**，与 `/api/vin/decode` 无关。

| 接口 | 典型文案 | 原因 |
|------|----------|------|
| `POST /api/half-cuts/upload-token` | `Locked` **HTTP 423** | nginx `limit_req` 临时锁定（批量上传后常见） |
| `POST /api/half-cuts/upload-token` | `Too many requests` **HTTP 429** | 服务端 `limitUploadToken` **80 次 / 小时 / IP** |
| `POST /api/half-cuts/submissions` | `Too many submissions` | 服务端 **30 次 / 小时 / IP** |

**VIN decode 失败**日志形态：`VIN decode failed for XXX: decode failed` — 是解码/目录查不到或 `ok:false`，**不是 429**。该接口在 `deploy/inventory-site-server.js` 无单独 rate limiter。

### 批量上传为何撞限流

每行 ≈ 多次 `upload-token`（多张照片）+ 1 次 `submissions`。  
无节流时 ~20s/行 → 一小时内轻松超过 **30 次提交** 和 **80 次 token**。

实测（2026-06-29 晚间）：
- row 34–114 约 77 行处理，仅 **13 行** submit 成功
- row 71+ 起大量 `Too many submissions`；row 108+ 起 `upload-token` 也 429

### Codex 可改方向（龙哥说 token 限流由他让 Codex 搞）

**服务端（推荐 bulk 导入场景）：**
- 提高 `limitSubmission` / `limitUploadToken` 或给 QXB 脚本用 service token / 白名单 IP 绕过
- 或 bulk 专用 endpoint 不计入供应商门户配额

**客户端（已实现初版）：**
- `inventory_core/qxb_pipeline.py`：CLI/批量默认 3 次 × 10s 退避；**审核页** `REVIEW_UI_UPLOAD_MAX_RETRIES=0` 遇限流立即返回
- `scripts/qxb-batch-remaining.py`：`--delay 12`、`--retry 4`、`--backoff 60`，423/429 指数退避重试
- 安全吞吐粗算：**≤25 行/小时**（受 submissions 30/h 卡脖子），行间 **≥15s** 更稳

**后台跑批注意：**
- 须 `required_permissions: all` 启动；sandbox 下 nohup 易被杀
- 日志：`reports/qxb-batch-upload.log`；进度：`reports/qxb-batch-progress.json`

---

## 4. 失败分类与处理

| 类型 | 典型错误 | 处理 |
|------|----------|------|
| 423 / 429 限流 | `Locked` / `Too many` | 仅 **白名单 IP** 跳过限流；其他客户保持原配额 |

### 上传限流白名单（仅 CEO 工作站）

批量/审核上传要同时满足：**有效 `SUPPLIER_UPLOAD_KEY`** + **出口公网 IP 在 `TRUSTED_SUPPLIER_UPLOAD_IPS`**。其他供应商门户用户仍受 nginx + Node 限流。

```bash
# 查本机公网 IP
curl -s https://ifconfig.me

# 生产服务器 .env（deploy 会写入 nginx geo）
TRUSTED_SUPPLIER_UPLOAD_IPS=你的公网IP
```

部署后 `nginx` 仅对白名单 IP 跳过 upload 路径的 `limit_req`；Node 层 `isTrustedBatchUploader` 同样校验 IP。
| 无 VIN | `OCR found no VIN` | `/qxb park <row>` 等 CEO；或手动 OCR/VIN CSV |
| decode 失败 | `VIN decode failed … decode failed` | 查 VIN 是否正确；`fallback_vin_decode`；仍失败则 park |
| ghost submit | 本地 pending 但服务器无 | reconcile → `unpark` → 重跑 submit-review |

---

## 5. 行状态快照（2026-06-29 批量中断时）

**已成功 submit（部分）：** 32, 33, 35, 36, 38, 40, 42, 43, 44, 47, 52, 54, 56, 60, 67 …

**parked（22 行，跳过）：** 含 14, 16, 23, 26, 28, 30 等无 VIN/不完整；24, 25, 27 曾本地 pending 需 reconcile

**剩余待传：** ~466 行（`count_remaining_upload_rows`）

**暂缓脚本：** `scripts/qxb-mark-parked.py` → `reports/qxb-parked-summary.json`

---

## 6. 常用命令

```bash
# 剩余行数
python3 -c "
from dotenv import load_dotenv; load_dotenv('.env')
from inventory_core import qxb_pipeline
p = qxb_pipeline.count_remaining_upload_rows(qxb_pipeline.load_context())
print(p['remainingCount'], 'next', p['nextRow'])
"

# 节流批量（后台）
python3 scripts/qxb-batch-remaining.py --delay 15 --retry 4 --backoff 60 \
  >> reports/qxb-batch-upload.log 2>&1

# 监控
tail -f reports/qxb-batch-upload.log
cat reports/qxb-batch-progress.json

# 收尾对账（main.py 内，需 ADMIN_PASSWORD）
/qxb reconcile
```

---

## 7. 照片与子龙识别

- 学习文件：`data/knowledge-base/qxb-photo-slot-learnings.json`
- 选图：`inventory_core/qxb_photo_pick.py` — rowOverrides → CEO exemplar → recognitionModel → heuristic
- VIN 尾图优先级：**18 > 17 > 16**（非升序）

---

## 8. 相关报告路径

| 文件 | 用途 |
|------|------|
| `reports/qxb-agent-queue.json` | 队列状态 |
| `reports/qxb-approved-import.json` | 已批准/已上传对照 |
| `reports/qxb-vin-ocr-results.csv` | OCR VIN |
| `reports/qxb-batch-upload.log` | 批量日志 |
| `reports/qxb-batch-progress.json` | 批量进度 |
| `reports/qxb-reconcile.json` | 对账结果（跑 reconcile 后） |

---

## 9. 续跑清单（给 Codex）

1. [ ] 确认 bulk 限流策略（服务端提配额 **或** 客户端 ≤25 行/h）
2. [ ] 停旧进程：`pkill -f qxb-batch-remaining`
3. [ ] 用 `--delay 15 --retry 4 --backoff 60` 重启 `qxb-batch-remaining.py`
4. [ ] 429 行会在 remaining 里再次出现，无需手工列表
5. [ ] 全部跑完 → `/qxb reconcile` → 处理 `missingOnServer`
6. [ ] parked 行 CEO 补 VIN 后 `/qxb unpark` 再传
