# 发动机文章知识核验记录

日期：2026-09-10。已落入正文：[BYD472QC](drafts/byd472qc-guide.md)、[BYD472ZQB](drafts/byd472zqb-guide.md)。

## 本轮实际完成

下载并读取 BYD 官方秦 PLUS、汉 L 手册，提取全文；渲染并人工查看两份手册的发动机标识位置页。核对诊断设备厂商关于缸压测试的说明，查阅零部件厂商技术资料和 BYD 区域服务说明。文章新增识别位置、正常工作与故障区分、验货局限、供货范围、安装准备、售后条款及加纳维修确认事项。

这里的“交叉核验”不是要求每句话必须有两个网站重复，而是检查来源身份、适用车型、原文上下文、是否支持结论，以及反例或不同解释是否推翻原判断。

## 采纳与排除

| 知识点 | 依据和核查 | 处理 |
|---|---|---|
| 秦 PLUS 发动机标识位置 | 官方手册 p376，已看页面图 | 按该车型写入，不推广到所有 BYD472QC 车型 |
| 汉 L 发动机标识位置 | 官方手册 p414，已看页面图 | 按该车型写入，与秦 PLUS 分开 |
| 长期纯电使用后的发动机保养启动 | 秦 PLUS p60 | 写成可能的正常行为，不称为通病 |
| 机油压力警告 | 秦 PLUS p58、汉 L p63 | 采用停车熄火及检查的完整指示，不从保养章节片段推导“补油就能继续开” |
| 动力系统警告 | 汉 L p64 | 写为需诊断，不能当作更换发动机依据 |
| 相对缸压与绝对缸压 | Pico 官方培训 | 写入方法区别；排除“100%代表全面合格”的说法 |
| 一组通用缸压合格值 | 未取得这两个版本的原厂维修阈值；Pico 提醒按车型条件解释 | 不发布数值，不将其他机型阈值移植过来 |
| 活塞环间隙与机油消耗 | Motorservice 提醒设计和工况会影响解释 | 不用通用文章证明两个 BYD 型号有活塞环缺陷，也不写成统一故障率 |
| QC 与 ZQB、同码跨车总成互换 | 车主手册不能证明零件号或装配互换 | 保留逐车核验要求，未编造互换表 |
| 质保期限与售后责任 | 地区新车服务信息不等于二手总成销售合同 | 写成应明确的交易条款，未虚构 AsiaPower 承诺 |
| 加纳备件和维修能力 | 没有对应供应商及维修点的最新实证 | 写成购买前确认内容，不宣传“当地配件充足” |
| 实拍识别照片 | 当前有官方示意图，无已核验且授权用于文章的对应实物照片 | 提供官方页面链接，不把示意图当实拍或复制为自有图片 |

## 来源

- [BYD 官方秦 PLUS 手册](https://www.byd.com/material/domestic-official/user-manual/dynasty/2026款秦PLUS%20DM-i用户手册20260120.pdf)，本轮完整下载和文字提取；相关页面图核验。
- [BYD 官方汉 L 手册](https://www.byd.com/material/domestic-official/user-manual/dynasty/汉L%20DM-i用户手册1104.pdf)，本轮完整下载和文字提取；相关页面图核验。
- [Pico：Compression testing](https://www.picoauto.com/library/picoscope-automotive-training/training/compression-testing-by-pico-technology)，读取正文。
- [Motorservice：Piston ring joint clearance and oil consumption](https://www.ms-motorservice.com/int/en/technipedia/piston-ring-joint-clearance-and-oil-consumption-270)，读取正文；仅作辨别推论局限的参考，未当 BYD 专属故障资料。
- [BYD Middle East & Africa 服务信息](https://www.byd.com/en-re/service-maintenance)，不能用于断言加纳拆车发动机具体保修。

## 完成边界

两篇已有英文正文已经补充，不是只新增写作计划。其余 50 个候选型号尚未完成相同深度的逐型号知识核验与正文，不能宣称全部文章已写完。

其他型号沿用本核验方法，资料由研究工作自行查找；只涉及实际报价、质保政策、实物检测或客户授权的内容，必须使用实际业务记录，不能由公开文章推断。

没有改动生产代码、发布网页、下载客户私有数据或对外询价。中间 PDF 和核验图在 `tmp/pdfs/engine-verification-20260910/`，不作为公开网站素材发布。
