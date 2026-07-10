# Facebook Groups — Google Search

Generated: 2026-07-05 09:36 UTC

Method: Python `requests` / `urllib` + 正则解析 HTML 中的 `facebook.com/groups/` 链接

说明：
- 目标为 Google 搜索结果页（`site:facebook.com/groups` + 关键词）
- Google 对脚本请求返回 **HTTP 200 但需 JS 渲染**，无法直接解析链接
- 同等查询改从 **Brave Search** 备用页解析（索引与 Google 高度重叠）
- 抓取在生产服务器执行（本地 IP 已 429 限流）

## 搜索关键词

- **auto parts ghana**: `site:facebook.com/groups 'auto parts' ghana`
- **spare parts nigeria**: `site:facebook.com/groups 'spare parts' nigeria`
- **used engines africa**: `site:facebook.com/groups 'used engines' africa`
- **car parts kenya**: `site:facebook.com/groups 'car parts' kenya`
- **combined**: `site:facebook.com/groups auto parts ghana nigeria kenya africa`

合并查询 URL：
- https://www.google.com/search?q=site:facebook.com/groups+auto+parts+ghana+nigeria+kenya+africa

## 各关键词命中数

| 关键词 | 群组数 | 数据来源 |
| --- | ---: | --- |
| auto parts ghana | 20 | Brave |
| spare parts nigeria | 20 | Brave |
| used engines africa | 17 | Brave |
| car parts kenya | 16 | Brave |
| combined | 18 | Brave |

去重后合计：**80** 条

## 抓取说明

### auto parts ghana
- 查询：`site:facebook.com/groups 'auto parts' ghana`
- Google [https://www.google.com/search?q=site%3Afacebook.com%2Fgroups+%27auto+parts%27+ghana&num=50&hl=en](https://www.google.com/search?q=site%3Afacebook.com%2Fgroups+%27auto+parts%27+ghana&num=50&hl=en) → HTTP 200，解析 0 条
- Brave（Google 无 HTML 结果时的备用） [https://search.brave.com/search?q=site%3Afacebook.com%2Fgroups+%27auto+parts%27+ghana&source=web](https://search.brave.com/search?q=site%3Afacebook.com%2Fgroups+%27auto+parts%27+ghana&source=web) → HTTP 200，解析 20 条

### spare parts nigeria
- 查询：`site:facebook.com/groups 'spare parts' nigeria`
- Google [https://www.google.com/search?q=site%3Afacebook.com%2Fgroups+%27spare+parts%27+nigeria&num=50&hl=en](https://www.google.com/search?q=site%3Afacebook.com%2Fgroups+%27spare+parts%27+nigeria&num=50&hl=en) → HTTP 200，解析 0 条
- Brave（Google 无 HTML 结果时的备用） [https://search.brave.com/search?q=site%3Afacebook.com%2Fgroups+%27spare+parts%27+nigeria&source=web](https://search.brave.com/search?q=site%3Afacebook.com%2Fgroups+%27spare+parts%27+nigeria&source=web) → HTTP 200，解析 20 条

### used engines africa
- 查询：`site:facebook.com/groups 'used engines' africa`
- Google [https://www.google.com/search?q=site%3Afacebook.com%2Fgroups+%27used+engines%27+africa&num=50&hl=en](https://www.google.com/search?q=site%3Afacebook.com%2Fgroups+%27used+engines%27+africa&num=50&hl=en) → HTTP 200，解析 0 条
- Brave（Google 无 HTML 结果时的备用） [https://search.brave.com/search?q=site%3Afacebook.com%2Fgroups+%27used+engines%27+africa&source=web](https://search.brave.com/search?q=site%3Afacebook.com%2Fgroups+%27used+engines%27+africa&source=web) → HTTP 200，解析 17 条

### car parts kenya
- 查询：`site:facebook.com/groups 'car parts' kenya`
- Google [https://www.google.com/search?q=site%3Afacebook.com%2Fgroups+%27car+parts%27+kenya&num=50&hl=en](https://www.google.com/search?q=site%3Afacebook.com%2Fgroups+%27car+parts%27+kenya&num=50&hl=en) → HTTP 200，解析 0 条
- Brave（Google 无 HTML 结果时的备用） [https://search.brave.com/search?q=site%3Afacebook.com%2Fgroups+%27car+parts%27+kenya&source=web](https://search.brave.com/search?q=site%3Afacebook.com%2Fgroups+%27car+parts%27+kenya&source=web) → HTTP 200，解析 16 条

### combined
- 查询：`site:facebook.com/groups auto parts ghana nigeria kenya africa`
- Google [https://www.google.com/search?q=site%3Afacebook.com%2Fgroups+auto+parts+ghana+nigeria+kenya+africa&num=50&hl=en](https://www.google.com/search?q=site%3Afacebook.com%2Fgroups+auto+parts+ghana+nigeria+kenya+africa&num=50&hl=en) → HTTP 200，解析 0 条
- Brave（Google 无 HTML 结果时的备用） [https://search.brave.com/search?q=site%3Afacebook.com%2Fgroups+auto+parts+ghana+nigeria+kenya+africa&source=web](https://search.brave.com/search?q=site%3Afacebook.com%2Fgroups+auto+parts+ghana+nigeria+kenya+africa&source=web) → HTTP 200，解析 18 条

## URL 列表（facebook.com/groups/）

https://www.facebook.com/groups/2326348074359132  <!-- auto parts ghana, combined -->
https://www.facebook.com/groups/301928555214396  <!-- auto parts ghana, combined -->
https://www.facebook.com/groups/feningcars  <!-- auto parts ghana, combined -->
https://www.facebook.com/groups/1255126757897671  <!-- auto parts ghana, combined -->
https://www.facebook.com/groups/1870312549911273  <!-- auto parts ghana, combined -->
https://www.facebook.com/groups/6403360716378181  <!-- auto parts ghana -->
https://www.facebook.com/groups/685422621496945  <!-- auto parts ghana -->
https://www.facebook.com/groups/nationbuilderscorps  <!-- auto parts ghana, combined -->
https://www.facebook.com/groups/750528146670256  <!-- auto parts ghana -->
https://www.facebook.com/groups/CarPartsSSS  <!-- auto parts ghana -->
https://www.facebook.com/groups/511508779323069  <!-- auto parts ghana -->
https://www.facebook.com/groups/1456719181306905  <!-- auto parts ghana, combined -->
https://www.facebook.com/groups/1939487566298305  <!-- auto parts ghana -->
https://www.facebook.com/groups/1421983201382103  <!-- auto parts ghana -->
https://www.facebook.com/groups/1536239923345035  <!-- auto parts ghana -->
https://www.facebook.com/groups/610831566450570  <!-- auto parts ghana -->
https://www.facebook.com/groups/realestateghana  <!-- auto parts ghana -->
https://www.facebook.com/groups/1595649984094656  <!-- auto parts ghana, combined -->
https://www.facebook.com/groups/278747944383991  <!-- auto parts ghana -->
https://www.facebook.com/groups/1188187554634186  <!-- auto parts ghana -->
https://www.facebook.com/groups/577777256711972  <!-- spare parts nigeria -->
https://www.facebook.com/groups/659426684167150  <!-- spare parts nigeria -->
https://www.facebook.com/groups/666490098399004  <!-- spare parts nigeria -->
https://www.facebook.com/groups/422933928669107  <!-- spare parts nigeria -->
https://www.facebook.com/groups/1617062581863413  <!-- spare parts nigeria -->
https://www.facebook.com/groups/landroversparesaccessoriesafrica  <!-- spare parts nigeria -->
https://www.facebook.com/groups/146418505089401  <!-- spare parts nigeria -->
https://www.facebook.com/groups/539504812902104  <!-- spare parts nigeria -->
https://www.facebook.com/groups/2637802773199622  <!-- spare parts nigeria, combined -->
https://www.facebook.com/groups/894883593934589  <!-- spare parts nigeria -->
https://www.facebook.com/groups/1273417579405888  <!-- spare parts nigeria -->
https://www.facebook.com/groups/217884688040311  <!-- spare parts nigeria -->
https://www.facebook.com/groups/1643983972286637  <!-- spare parts nigeria -->
https://www.facebook.com/groups/631857578799715  <!-- spare parts nigeria -->
https://www.facebook.com/groups/154804901761313  <!-- spare parts nigeria -->
https://www.facebook.com/groups/350061032422313  <!-- spare parts nigeria -->
https://www.facebook.com/groups/1142729052523668  <!-- spare parts nigeria -->
https://www.facebook.com/groups/273450813708045  <!-- spare parts nigeria -->
https://www.facebook.com/groups/663199487121043  <!-- spare parts nigeria -->
https://www.facebook.com/groups/405004908149255  <!-- spare parts nigeria -->
https://www.facebook.com/groups/186934038776108  <!-- used engines africa -->
https://www.facebook.com/groups/219154005305239  <!-- used engines africa -->
https://www.facebook.com/groups/404473337014578  <!-- used engines africa -->
https://www.facebook.com/groups/687158759769363  <!-- used engines africa -->
https://www.facebook.com/groups/satractors  <!-- used engines africa -->
https://www.facebook.com/groups/2376354029172770  <!-- used engines africa -->
https://www.facebook.com/groups/1959390234313377  <!-- used engines africa -->
https://www.facebook.com/groups/541376762663925  <!-- used engines africa -->
https://www.facebook.com/groups/886492885367323  <!-- used engines africa -->
https://www.facebook.com/groups/1687733454647120  <!-- used engines africa -->
https://www.facebook.com/groups/1563185587309520  <!-- used engines africa -->
https://www.facebook.com/groups/1360104134818544  <!-- used engines africa -->
https://www.facebook.com/groups/212977477500291  <!-- used engines africa -->
https://www.facebook.com/groups/1619539854925051  <!-- used engines africa -->
https://www.facebook.com/groups/348609017628600  <!-- used engines africa -->
https://www.facebook.com/groups/5859044167456048  <!-- used engines africa -->
https://www.facebook.com/groups/499705025021548  <!-- used engines africa -->
https://www.facebook.com/groups/spareskenya  <!-- car parts kenya -->
https://www.facebook.com/groups/223171301114869  <!-- car parts kenya -->
https://www.facebook.com/groups/618800375184636  <!-- car parts kenya -->
https://www.facebook.com/groups/nairobisparepartssellbuy  <!-- car parts kenya -->
https://www.facebook.com/groups/977179419788093  <!-- car parts kenya -->
https://www.facebook.com/groups/carsforsalekenya  <!-- car parts kenya -->
https://www.facebook.com/groups/490983944394994  <!-- car parts kenya -->
https://www.facebook.com/groups/mitsubishiownerske  <!-- car parts kenya -->
https://www.facebook.com/groups/TUJENGANE  <!-- car parts kenya -->
https://www.facebook.com/groups/1137435192955928  <!-- car parts kenya, combined -->
https://www.facebook.com/groups/593022588028947  <!-- car parts kenya -->
https://www.facebook.com/groups/259767277538868  <!-- car parts kenya -->
https://www.facebook.com/groups/711765658879311  <!-- car parts kenya -->
https://www.facebook.com/groups/186720749248545  <!-- car parts kenya, combined -->
https://www.facebook.com/groups/275195129830100  <!-- car parts kenya -->
https://www.facebook.com/groups/373789947788960  <!-- car parts kenya -->
https://www.facebook.com/groups/classic.cars.kenya  <!-- combined -->
https://www.facebook.com/groups/1474946736161083  <!-- combined -->
https://www.facebook.com/groups/1174035939780070  <!-- combined -->
https://www.facebook.com/groups/184845025754032  <!-- combined -->
https://www.facebook.com/groups/3549176548476063  <!-- combined -->
https://www.facebook.com/groups/289595181148381  <!-- combined -->
https://www.facebook.com/groups/355929772403216  <!-- combined -->
