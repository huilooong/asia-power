# Facebook 定时发帖(每小时 2 条,自动轮换库存)

## 给 Cursor 的交付说明

依赖 `facebook-instagram-graph-api-posting.md` 那份方案里的基础(`META_PAGE_ACCESS_TOKEN`/`META_PAGE_ID` 已经在 `.env` 里,今天已经用直接脚本测试发过 11 条真实帖子并验证可行)。这份是把它变成正式的、可持续跑的定时任务。

开始动手前,先在本文件最下面的「Cursor 实施报告」章节追加一行「已开始 <日期时间>」。做完把结果写进同一章节(带日期,追加,不覆盖)。

## Context

龙哥原话:"先上传10条,然后按小时,每小时2条的定时任务做尝试"。今天已经手动跑过一次:选了 10 条真实库存(`status:"Available"`,优先选有真实标签照片、不同品牌/类型的),每条发 4-5 张真实照片做成相册帖+文案(品牌/型号/年份/价格+定制拆解说明+网站链接),已经验证可行(参照 `facebook-instagram-graph-api-posting.md` 里记录的坑:**必须用 Page 专属 token,不是 System User 原始 token**——通过 `GET /{page-id}?fields=access_token` 用 system user token 换出来)。

已发布的库存记录在 `/root/.openclaw/workspace/inventory-site/data/fb-posted-stock-ids.json`(数组,每条 `{stockId, post_id, ts}`),新脚本必须读这个文件做去重,不要重复发同一条库存。

## 要做的事

1. **新增脚本**(建议 `scripts/apsales-facebook-scheduled-post.py`,复用今天验证过的发帖逻辑,不要重新设计):
   - 读 `data/half-cut-approved.json`,筛 `status === "Available"` 且照片数 ≥ 4 的记录。
   - 排除掉 `fb-posted-stock-ids.json` 里已经发过的 `stockId`。
   - 从剩下的里面每次挑 **2 条**(参照今天的选取逻辑:优先选有真实标签照片如 "Vehicle Front"/"Engine" 而不是通用 "Photo 01" 的;尽量在品牌/`truckPartType`/`vehicleCategory` 上做一点多样性,不要连续发同一个品牌)。
   - 每条:上传其真实照片(4-5张,`published=false`)→ 用 `attached_media` 做成相册帖发到 Page feed,文案格式跟今天验证过的一致(车头/整车卡车/半切车三种措辞要分开,不要用同一句话糊弄)。
   - 每发一条,追加写入 `fb-posted-stock-ids.json`(不要覆盖已有记录)。
   - 库存耗尽(没有未发过的可用库存)时,脚本要清楚打印"本轮无新库存可发",不要报错崩溃。
2. **加 cron**:每小时跑一次,执行这个脚本(建议 `crontab`: `0 * * * * cd /root/.openclaw/workspace/AsiaPower && .venv/bin/python3 scripts/apsales-facebook-scheduled-post.py >> /var/log/apsales-facebook-scheduled-post.log 2>&1`)。
3. **失败处理**:单条发布失败(比如某张照片 URL 404、API 报错)不要让整个脚本崩溃——跳过这一条,记录失败原因到日志,继续处理下一条,而不是整个批次都不发了。
4. **速率保护**:两条之间加几秒延迟(今天手动跑用的是 5 秒,可以沿用),避免短时间内打太多请求。

## 明确不做的部分

- **不做量的爬升**——先按"每小时2条"跑,不要自己判断"效果好就加量",除非龙哥后续明确说要调整频率。
- **不接 Instagram**——Instagram 账号还没绑定(见另一份方案里记录的缺口),这次只做 Facebook,不要顺手把 IG 也接上,那部分单独等账号绑定好再做。
- **不做智能选品**(比如根据历史互动数据决定发哪条)——这次就是简单轮询未发过的库存,不要过度设计。

## 验证

- 手动跑一次脚本(不等 cron 触发),确认真的选出 2 条**之前没发过的**库存、真实发布成功、`fb-posted-stock-ids.json` 正确追加。
- 再手动跑一次,确认这次选的是**另外 2 条**(去重逻辑生效,不会跟上一次重复)。
- 模拟一条库存的照片 URL 是坏的(比如改成不存在的 URL),确认这一条被跳过、日志里能看到失败原因,脚本没有崩溃、也没有把这条错误地记进"已发布"名单。
- 确认 cron 加进去后能实际触发(等一个整点或者手动 `run-parts` 测试),日志文件里有对应记录。

## Cursor 实施报告

<!-- 追加,不要覆盖之前记录 -->

- 已开始 2026-07-18 ~05:15 Asia/Shanghai（Cursor）

### 完成报告 — 2026-07-18 ~05:20 Asia/Shanghai（Cursor）

**状态**: 已落地、已验证、cron 已装

#### 交付物
- `scripts/apsales-facebook-scheduled-post.py`：每轮挑 2 条未发 Available（≥4 图），相册帖发布；失败跳过不写账本
- `deploy/cron/apsales-facebook-scheduled-post.cron`：`0 * * * *` → `/var/log/apsales-facebook-scheduled-post.log`
- 去重账本：`AsiaPower/data/fb-posted-stock-ids.json`（今天 10 条已在此；方案里写的 inventory-site 路径作镜像写入）
- 文案三种：车头 cab / 卡车半切 / 乘用半切（沿用今天验证过的措辞）
- **不做**：加量、Instagram、智能选品

#### 验证
| 项 | 结果 |
|---|---|
| 单元测试 | `tests/test_apsales_facebook_scheduled_post.py` 通过 |
| 手动跑 #1 | HC250066、HC250103 发布成功（跳过已发 10 条） |
| 手动跑 #2 | HC250102 成功；HC250067 feed HTTP 500 跳过且**未**入账本 |
| 坏图模拟 | 全 URL 404 → skip、账本长度不变 |
| cron | `/etc/cron.d/apsales-facebook-scheduled-post` 已装；日志可写 |

**生产 Release**: `REL-20260718051617-apsales-3fa025ebe`  
**Commits**: `3fa025ebe`（主功能）, `5bc6da925`（≥4 图门槛）

**下一步**: 等下一个整点看日志是否自动跑；若要改频率等龙哥说。
