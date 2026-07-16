# YouTube 库存视频上传 · 2026-07-16

## 结果

| 项 | 结果 |
|----|------|
| 授权 | 成功（网站 Web OAuth + 本地回调 8765） |
| YouTube Data API v3 | 已启用 |
| 上传成功 | **18 / 21**（公开） |
| 上传失败 | **3**（新频道日限额 `uploadLimitExceeded`） |
| 生产库存 JSON | 已回写 18 条 `videoUrl` + `youtubeVideoId`；备份 `half-cut-approved.json.pre-youtube.bak` |
| 详情页嵌入代码 | **本地已有，生产未部署**（现网 `half-cut-directory.js` 无 YouTube iframe） |

## 待重试（明日）

- HC250067
- HC250063
- HC250036

清单：`work/youtube-inventory-migrate/upload-pending-retry.json`

## 成功示例

- HC250241 → https://www.youtube.com/watch?v=5ktE5s2jt2k
- HC250516 → https://www.youtube.com/watch?v=DVlV492JvJY

完整映射：`work/youtube-inventory-migrate/upload-results.json`

## 下一步

1. 部署 chrome/home：`js/half-cut-directory.js` + detail cache bust（`youtube-embed-v1`）→ 详情页播 YouTube  
2. 明日重传剩余 3 条并再 patch JSON  
