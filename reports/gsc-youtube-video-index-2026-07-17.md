# GSC Video Index 抓不到视频 · 2026-07-17

## 结论

换成 YouTube 后，[GSC Video Index](https://search.google.com/search-console/video-index?resource_id=https%3A%2F%2Fasia-power.com%2F) 变空/下降，**符合预期根因**：

| 以前（本站 mp4） | 现在（YouTube） |
|---|---|
| `videoUrl` = `asia-power.com/uploads/videos/…` | `videoUrl` = `youtube.com/watch?v=…` |
| 谷歌可在本站域名下发现视频文件 | 视频文件在 YouTube，不在 asia-power.com |
| 无 VideoObject 时仍可能靠文件 URL 发现 | **必须**用 VideoObject + embedUrl 声明嵌在详情页的播放器 |

另外：详情页播放器原先只靠浏览器 JS 注入，爬虫看到的静态 HTML **没有** iframe，也没有 `VideoObject`。

## 已修

1. Product JSON-LD 增加 `video` → `VideoObject`（`embedUrl` = YouTube embed；缩略图用 ytimg）
2. 服务端预渲染详情页在 About 区直接输出 YouTube iframe（不依赖 JS）
3. 客户端 `productJsonLd` 同步带 VideoObject（`youtube-embed-v2`）

## 部署后你在 GSC 做什么

1. 等 1–3 天看 Video indexing 是否回升（通常要 1–4 周完全稳住）
2. 用 URL 检查抽查：  
   `https://asia-power.com/half-cuts/detail.html?slug=toyota-corolla-2014-1zr-fe-half-cut-hc250241`  
   看是否检测到视频 / VideoObject
3. 不必期待「本站视频文件数」回到换链前——索引的是**带视频的网页**，不是 YouTube 频道本身

参考：[Google Video SEO](https://developers.google.com/search/docs/appearance/video)
