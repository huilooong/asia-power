# Google Vision 免费档启用（WhatsApp OCR）

## 现状（2026-07-14）

- 生产已有 `GOOGLE_PLACES_API_KEY`（GCP 项目 `1044386397132`）
- ✅ Vision API **已启用**（CEO 确认）
- ❌ 现有 Key 仍被拦住：`API_KEY_SERVICE_BLOCKED`（Key 的「API 限制」没勾选 Cloud Vision）
- **卡点：给 Key 放行 Vision（或新建一把只给 Vision 的 Key）**

## 你要做的（约 1 分钟）— 放行 Key

打开：**[API 凭据 / Credentials](https://console.cloud.google.com/apis/credentials?project=1044386397132)**

**方式 A（推荐，改现有 Places Key）**
1. 点开现在那把 API Key（Places 用的那把）
2. 找到 **API restrictions / API 限制**
3. 选 **Restrict key**，在列表里勾选：
   - Places API（原来的保留）
   - **Cloud Vision API**（新增）
4. 保存 → 等 1–2 分钟生效  
5. 回我：**「Key 已放行」**

**方式 B（新建一把 Vision 专用 Key）**
1. 同一页点 **Create credentials → API key**
2. 限制应用 API：只勾选 **Cloud Vision API**
3. 把新 Key 私聊发给我（不要发群、不要贴公开文档）
4. 我写入生产 `APSALES_GOOGLE_VISION_API_KEY` 并启用

## 已完成（2026-07-14）

| 项 | 结果 |
|---|---|
| Vision API | ✅ 已启用 |
| Key 放行 Cloud Vision | ✅ |
| `APSALES_OCR_PROVIDER=google` | ✅ 生产 bridge |
| EnvironmentFile → AsiaPower `.env` | ✅ 复用 Places Key |
| E2E 合成铭牌 | ✅ `ocr_engine=google_vision`，FRAME `SCP90-5185026` |

说明：下次跑 `deploy-production.mjs apsales-openclaw` 时，注意勿把 OCR 写回 `tesseract`；应保持 `google`。

## Speech-to-Text（同项目，2026-07-14 已上线）

| 项 | 结果 |
|---|---|
| Speech API | ✅ 已启用并放行 |
| `APSALES_STT_PROVIDER=google` | ✅ |
| WAV E2E | ✅ `I need a Toyota engine, please.` |
| OGG/Opus（WhatsApp） | ✅ 需 `sampleRateHertz`；默认 16k，失败回退 48k |

启用链接（备用）：  
https://console.developers.google.com/apis/api/speech.googleapis.com/overview?project=1044386397132

## 回滚

```bash
# production drop-in
Environment=APSALES_OCR_PROVIDER=tesseract
systemctl daemon-reload && systemctl restart apsales-whatsapp-bridge.service
```
