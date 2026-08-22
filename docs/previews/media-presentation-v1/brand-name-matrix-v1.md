# AsiaPower controlled make names V1

Verified production snapshot: 599 public inventory records and 60 distinct make values on 2026-08-22.

## Display policy

- A make is an identity field. It is never sent to general translation, semantic translation or guessed transliteration.
- English uses the official Latin trademark in uppercase.
- French and Arabic retain the same official Latin trademark in uppercase unless a manufacturer-controlled localized trademark is separately approved.
- Chinese uses the reviewed manufacturer name below.
- An unknown make falls back to the original source spelling in uppercase. It is never guessed.
- This layer changes visible page text only. Inventory records, API identifiers, slugs, URLs, form values, SEO metadata and JSON-LD are not rewritten.
- Public shells reject browser auto-translation and identity nodes are marked non-translatable so a browser cannot overwrite reviewed make names after render.
- `Fangchengbao`, `Fang Cheng Bao` and `方程豹` are aliases of one controlled record: EN/FR/AR `FANGCHENGBAO`; ZH `方程豹`. `方城堡` is prohibited by regression test.

## Live-inventory matrix

| Production value | EN / FR / AR | ZH |
|---|---|---|
| Audi | AUDI | 奥迪 |
| Beiben | BEIBEN | 北奔重汽 |
| BMW | BMW | 宝马 |
| Buick | BUICK | 别克 |
| BYD | BYD | 比亚迪 |
| Cadillac | CADILLAC | 凯迪拉克 |
| CAMC | CAMC | 华菱汽车 |
| Changan | CHANGAN | 长安 |
| Changan Kuayue | CHANGAN KUAYUE | 长安跨越 |
| Chery | CHERY | 奇瑞 |
| Chevrolet | CHEVROLET | 雪佛兰 |
| Chrysler | CHRYSLER | 克莱斯勒 |
| Citroën | CITROËN | 雪铁龙 |
| Denza | DENZA | 腾势 |
| Dodge | DODGE | 道奇 |
| Dongfanghong | DONGFANGHONG | 东方红 |
| Dongfeng | DONGFENG | 东风 |
| Fangchengbao | FANGCHENGBAO | 方程豹 |
| FAW | FAW | 一汽 |
| Ford | FORD | 福特 |
| Geely | GEELY | 吉利 |
| GMC | GMC | GMC |
| Great Wall | GREAT WALL | 长城 |
| Haval | HAVAL | 哈弗 |
| Hino | HINO | 日野 |
| Honda | HONDA | 本田 |
| Hongyan | HONGYAN | 上汽红岩 |
| HOWO | HOWO | 豪沃 |
| Hyundai | HYUNDAI | 现代 |
| Hyundai Trucks | HYUNDAI TRUCKS | 现代商用车 |
| Isuzu | ISUZU | 五十铃 |
| JAC | JAC | 江淮 |
| Jeep | JEEP | JEEP |
| Jinbei | JINBEI | 金杯 |
| JMC | JMC | 江铃 |
| Kia | KIA | 起亚 |
| Land Rover | LAND ROVER | 路虎 |
| Lexus | LEXUS | 雷克萨斯 |
| Liebao | LIEBAO | 猎豹汽车 |
| Lonking | LONKING | 龙工 |
| Lovol | LOVOL | 雷沃 |
| MAN | MAN | 曼恩 |
| Maxus | MAXUS | 上汽大通MAXUS |
| Mazda | MAZDA | 马自达 |
| Mercedes-Benz | MERCEDES-BENZ | 梅赛德斯-奔驰 |
| MG | MG | 名爵 |
| Mitsubishi | MITSUBISHI | 三菱 |
| Nissan | NISSAN | 日产 |
| Peugeot | PEUGEOT | 标致 |
| Roewe | ROEWE | 荣威 |
| Sany | SANY | 三一 |
| Shaanxi Auto | SHAANXI AUTO | 陕汽 |
| Shacman | SHACMAN | 陕汽重卡 |
| Sinotruk | SINOTRUK | 中国重汽 |
| Suzuki | SUZUKI | 铃木 |
| Tank | TANK | 坦克 |
| Toyota | TOYOTA | 丰田 |
| Volkswagen | VOLKSWAGEN | 大众 |
| Volvo | VOLVO | 沃尔沃 |
| Wuling | WULING | 五菱 |

## Authority notes

- Chinese `方程豹`: Fangchengbao official Chinese site and company identity.
- International `FANGCHENGBAO`: BYD official English announcements and corporate reports.
- Production values and aliases are retained as internal lookup inputs; the display registry does not rewrite stored records.
- The registry also covers the wider passenger-brand directory and common commercial makes so every public category uses the same rule.
