# VIN 解析后发"确认卡片"给客户(提升专业感)

## 给 Cursor 的交付说明

这是新功能,不是 bug 修复,跟今天另一份事故方案(`whatsapp-vin-qualify-hard-rule-and-bridge-watchdog.md`)是两件独立的事,不要合并处理,那份优先级更高,先做那份。

开始动手前,先在本文件最下面的「Cursor 实施报告」章节追加一行「已开始 <日期时间>」。做完把结果写进同一章节(带日期,追加,不覆盖)。

## Context

龙哥的原话:"客户发送底盘号,我们把解析的信息,如品牌,车型,年份,发动机型号,发动机排量等等,做成一条类似卡片信息发给客户进行确认"——目的是提升客户对我们专业性的感知,让客户一眼确认"对,这就是我的车"。

现状(已核实,不是猜的):`bridge.mjs` 里 `plateSuccessReply()` 函数,VIN/铭牌识别成功后现在发的是:

```
Got it — NISSAN / 2021 / HARDBODY / YD25289129T. Do you need the engine, gearbox, or the half-cut?
```

品牌/年份/型号/发动机代码用斜杠硬挤在一句话里,没有分行、没有标签,谈不上"卡片"感。而且**发动机排量(displacement)这个字段现在完全没有被解析出来**——查了 `apsales-media-vin-intelligence.py`,数据源是 NHTSA vPIC API,这个 API 本身的标准返回里就带 `DisplacementL` 字段,只是现在的代码没有把这个字段从 API 返回里提取出来存进 `vehicle` 对象,不是 API 没有这个数据,是代码没接。

## 要做的事

1. **在 `apsales-media-vin-intelligence.py` 里补上 displacement 字段的提取**——从 NHTSA 返回结果里取 `DisplacementL`(或者对应字段名,以实际 API 返回结构为准,不要凭空猜字段名,先真实调一次 API 看返回结构),加进 `vehicle` 对象。
2. **把 `plateSuccessReply()` 的输出格式从单行斜杠拼接改成结构化多行"卡片"样式**——WhatsApp 这条线走的是普通消息(不是 Business API 的模板消息/rich card),做不出真正意义上的富媒体卡片,但可以用换行+标签做出"卡片感",参考格式(具体文案风格可以调整,不要照抄):

```
✅ Vehicle confirmed
Brand: Nissan
Model: Hardbody
Year: 2021
Engine: YD25 (2.5L)

Is this correct? What part are you looking for — engine, gearbox, or half-cut?
```

3. 品牌/型号/年份/发动机代码/排量,哪些字段有值就显示哪些,没有的字段直接跳过那一行(不要显示空字段或者"未知"这种占位符,参照现有 `bits.filter(Boolean)` 那种写法)。
4. 保留原有"确认后直接问要哪个部位"这个收尾问题,不要因为改格式就把这个问题弄丢了。

## 验证

- 构造一个 mock 场景:VIN 解码成功、品牌/型号/年份/发动机代码/排量全部有值,断言输出是多行结构化格式,包含全部字段。
- 构造一个场景:排量字段缺失(比如某些老车型 NHTSA 没有这个数据),断言那一行被跳过,不显示空值,其它字段正常显示。
- 用今天真实出现过的例子(Zambia 客户,Nissan Hardbody,YD25289129T)跑一次,人工看一下最终 WhatsApp 消息实际显示效果是否像"卡片"。
- 确认改动没有影响 `LIVE-RULES.md` 里"VIN 确认后不要重复问已知信息"那条规则——这条卡片本身就是一次性确认,不要变成每轮都重复发一遍。

## Cursor 实施报告

<!-- 追加,不要覆盖之前记录 -->

- 已开始 2026-07-17 ~23:21 Asia/Shanghai（Cursor）
