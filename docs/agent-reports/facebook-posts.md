# Facebook Group Posts — Result

**Run time:** 2026-07-05 09:17 UTC  
**Account:** Playwright 会话（Facebook 已登录，账号显示名：惠龙）  
**Script:** `scripts/fb-group-post-once.py`  
**Image:** `assets/images/supply-halfcut.jpg`

## Post content (planned)

```
Looking for used engines, half-cuts or auto parts from China? 🔧

We are AsiaPower — verified used parts exporter.
Browse our catalog 👉 www.asia-power.com
WhatsApp: +86 186 0377 3077

Same-day quotes. Real stock photos before shipment.
```

---

## Results

| # | Group | URL | Status | Reason |
|---|-------|-----|--------|--------|
| 1 | Auto Parts Ghana | https://www.facebook.com/groups/autopartsghana | ❌ **失败** | 群组页面显示「**内容暂时无法显示**」— 无发帖框、无「加入小组」按钮；Facebook 搜索也找不到该 slug，群组可能已删除或改名 |
| 2 | Nigeria Auto Spare Parts | https://www.facebook.com/groups/nigeriaautospareparts | ❌ **失败** | 同上 — 页面不可用，搜索 `nigeriaautospareparts` 无匹配群组 |

### Technical detail

- Facebook 首页登录：**成功**（可看到动态、创建帖子入口）
- 进入上述群组 URL 后：页面正文为「内容暂时无法显示…所有者只与一小群用户分享了内容、更改了分享对象或删除了内容」
- 自动化尝试：打开发帖 composer → **未找到**（`Write something…` / `Create a post` 均为 0）
- 截图（调试）：`/tmp/fb-group-autopartsghana.png`、`/tmp/fb-group-nigeriaautospareparts.png`

```json
{
  "ok": false,
  "results": [
    {
      "ok": false,
      "group_url": "https://www.facebook.com/groups/autopartsghana",
      "error": "post_failed",
      "page_url": "https://web.facebook.com/groups/autopartsghana?_rdc=1&_rdr"
    },
    {
      "ok": false,
      "group_url": "https://www.facebook.com/groups/nigeriaautospareparts",
      "error": "post_failed",
      "page_url": "https://web.facebook.com/groups/nigeriaautospareparts?_rdc=1&_rdr"
    }
  ],
  "finished_at": "2026-07-05 09:16 UTC"
}
```

---

## 下一步建议

1. **请 CEO 在浏览器里手动打开上述两个链接**，确认是否能看到群组（若您 Chrome 里是另一个 FB 账号，可能与自动化账号不同）。
2. 若链接失效，改用仍可访问的加纳/尼日利亚汽配群，例如搜索可见的：
   - Ghana：`AUTO PARTS DEALER IN GHANA`、`Spare parts Ghana.`
   - Nigeria：`Car Spare Parts sale in Nigeria`、`ASPMDA AUTO PARTS MARKET, NIGERIA`
3. 确认正确群组 URL 后，可再运行：
   ```bash
   APSALES_SOCIAL_BROWSER_HEADLESS=0 .venv/bin/python3 scripts/fb-group-post-once.py
   ```
   （需先更新脚本里的 `GROUPS` 列表）

---

**Status:** ❌ 两个群组均未发帖  
**Deliverables:** 本报告 + 脚本 `scripts/fb-group-post-once.py`  
**Validation:** Playwright 登录 OK；目标群组不可访问 → 发帖未完成
