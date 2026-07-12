# OPS · 底盘与变速箱类目过滤修复

**日期：** 2026-07-12  
**状态：** 已通过 Release Manager 上线并完成现网 DOM 与截图验证  
**范围：** 底盘、发动机、变速箱、半切/车头公开目录  
**上一版本：** `REL-20260712145020-categories-abaa121e0`

## 结论

上轮修复解决了动力总成跨类目污染，但把底盘规则从“所有乘用车都放行”收紧成“只认
`passengerPartType=chassis`”。生产当前没有任何显式 `chassis` 记录，因此底盘从
**445 条（绝大多数误放）直接变成 0 条（误杀合法库存）**。

生产原始数据与公开字段逐条盘点后，真正有乘用车底盘证据的是 **HC250488**：
该 RAV4 的 `includedParts` 明确写着“listing covers remaining rear/chassis portion only”。
本次只恢复这一条，不把 445 条宽泛乘用车库存重新塞回底盘。

今日福特批次 HC250556–HC250565 的原始备注确认是 **9 条发动机 + 1 条独立变速箱**，
没有错标。历史上另有 4 条福特半切自带变速箱，因此变速箱目录里的福特相关库存应为
**5 条：1 条独立变速箱 + 4 条历史半切**。

## 一、先盘点数据真相

### 1. 底盘过滤前后

| 阶段 | 底盘数量 | 说明 |
|---|---:|---|
| Release 备份中的旧前端规则 | 445 | `chassis` 对乘用车目录直接 `return true`，大量误放 |
| 上轮 Release 后 | 0 | 只认显式 `passengerPartType=chassis`，造成 false negative |
| 本次证据规则（现网） | 1 | 仅 HC250488 有公开底盘段证据 |

对比依据：

- Release snapshot：`releases/REL-20260712145020-categories-abaa121e0/snapshots/`
- 远程全量备份：`backups/scheduled/asia-power-backup-20260712-145023.tar.gz`
- 公开库存：`https://asia-power.com/api/half-cuts/public`，盘点时 519 条
- 原始生产数据：`data/half-cut-approved.json`（仅用于核对 notes/字段，报告不写 VIN/供应商隐私）

### 2. 误杀清单与恢复清单

| stockId | 类型 | 数据证据 | 处理 |
|---|---|---|---|
| HC250488 | Toyota RAV4 后部/底盘段 | `passengerPartType=front`；`includedParts` 明确“remaining rear/chassis portion only” | 恢复到底盘，同时保留车头/半切目录 |

误杀清单即 HC250488；恢复清单同为 HC250488，共 **1 条**。没有发现第二条乘用车库存
具备公开底盘字段或底盘部件文字证据。HC250058 虽提到 chassis，但它是 Isuzu 卡车半切；
HC250107 是工程机械，均不进入乘用车底盘目录。

### 3. 今日福特批次真相

| stockId | 主分类 | 状态证据 | 发动机 | 变速箱 |
|---|---|---|---|---|
| HC250556 | 发动机 | `engine` / `Engine Assembly` | CAF372WQ | MT |
| HC250557 | 发动机 | `engine` / `Engine Assembly` | CAF384Q | AT |
| HC250558 | 发动机 | `engine` / `Engine Assembly` | CAF384Q | MT |
| HC250559 | 发动机 | `engine` / `Engine Assembly` | CAF384Q | — |
| HC250560 | 发动机 | `engine` / `Engine Assembly` | CAF384WQ | — |
| HC250561 | 发动机 | `engine` / `Engine Assembly` | CAF488WQ | AT |
| HC250562 | 发动机 | `engine` / `Engine Assembly` | CAF488WQ | — |
| HC250563 | 发动机 | `engine` / `Engine Assembly` | GTDIQ8 | — |
| HC250564 | 发动机 | `engine` / `Engine Assembly` | CAF488Q10 | — |
| HC250565 | 变速箱 | `transmission` / `Transmission Assembly`；notes 写“变速器总成、33台” | — | AT |

注意：发动机条目里出现 `AT` / `MT` 只是来源清单的适配/搭配信息，主分类字段和 notes
仍是发动机总成，不能据此改成独立变速箱。HC250566 是后续单独发动机，不属于上述 10 行，
其字段为 `engine` / `Engine Assembly` / `G4FC`。

### 4. 全部变速箱与福特清单

按现行业务规则，变速箱目录包括“独立变速箱”以及“自带 transmissionCode 的真正半切”：

- 全站变速箱目录：427 条
- 独立变速箱：2 条（HC250565 Ford、HC250546 Volkswagen）
- 福特相关：5 条

| stockId | 福特变速箱来源 | 变速箱 | 主分类 |
|---|---|---|---|
| HC250132 | 2012 Fiesta 半切 | 6DCT | 真正半切 |
| HC250524 | 2012 Focus 半切 | 5MT | 真正半切 |
| HC250528 | 2012 Focus 半切 | 5MT | 真正半切 |
| HC250536 | 2015 Escort 半切 | 6AT | 真正半切 |
| HC250565 | 2019–2021 Focus 独立变速箱 | AT | `transmission` |

因此“今天这批只有 1 条福特独立变速箱”是数据事实；但“福特相关变速箱目录只有 1 条”
不成立，历史半切计入后应为 5 条。

## 二、规则修订

上轮具体误杀条件：

```js
if (category === 'chassis') return partType === 'chassis';
```

本次改为“主分类优先 + 底盘公开证据”：

1. 显式 `passengerPartType=chassis` 永远进入底盘。
2. 独立 `engine` / `transmission` / `other` 即使文字出现 chassis，也禁止进入底盘。
3. 真正半切或 `front` donor cut 只有在公开 title、shortDescription、includedParts、
   originalVehicleName、照片标签中明确出现 chassis/subframe/suspension/axle/底盘等证据，
   才进入底盘。
4. 卡车与工程机械继续排除在乘用车底盘目录外。
5. 搜索只扩大匹配字段，不扩大类目。

这不是“乘用车全排除”，也不是“为了非空恢复全量”；是按库存本身公开属性逐条准入。

## 三、实施

修改：

- `js/half-cut-directory.js`：新增 `hasChassisCatalogEvidence()`，底盘改为证据准入。
- `scripts/verify-category-filter.mjs`：加入真实生产 count、HC250488 恢复、防关键词串类、
  福特 5 条变速箱回归。
- `scripts/deploy-production.mjs`：`categories` 缓存键升级为 `category-filter-v2`。

数据：

- **没有修改库存数据，没有删除记录，没有改价格。**

## 四、验证

预发布真实数据回归：

| 检查 | 结果 |
|---|---|
| `node scripts/verify-category-filter.mjs` | 通过 |
| JavaScript 语法 | 通过 |
| `git diff --check` | 通过 |
| 底盘 | 1 条：HC250488 |
| 发动机 | 436 条 |
| 变速箱 | 427 条 |
| 福特变速箱相关 | 5 条：HC250132、HC250524、HC250528、HC250536、HC250565 |
| 车头 | 432 条；HC250556–HC250566 独立动力总成均不进入 |

现网页面 DOM 实测：

| 页面 | 现网结果 |
|---|---|
| `/chassis-parts/` | 1 条，列表 stockId 仅 HC250488 |
| `/gearboxes/?brand=ford` | 5 条，5 个福特 stockId 全部显示 |
| `/engines/` | 436 条；首屏含 HC250556–564、566，且不含 HC250565 |
| `/front-cuts/?q=HC250565` | 0 条 |

截图：

- `docs/ops/evidence/chassis-restored-live-20260712.png`
- `docs/ops/evidence/ford-gearboxes-live-20260712.png`
- `docs/ops/evidence/engines-count-live-20260712.png`
- `docs/ops/evidence/frontcut-powertrain-exclusion-live-20260712.png`

## 五、发布与回滚

- Git commit：`d2b0161e350874705dc8ff9636f79e7ab88d60f2`
- GitHub branch：`chore/backfill-2026-07-10-prod`
- Release ID：`REL-20260712150522-categories-d2b0161e3`
- 备份：`/root/.openclaw/workspace/inventory-site/backups/scheduled/asia-power-backup-20260712-150524.tar.gz`
- Release snapshots：`releases/REL-20260712150522-categories-d2b0161e3/snapshots/`
- 回滚：`RESTORE_CONFIRM=REL-20260712150522-categories-d2b0161e3 node scripts/release-restore.mjs REL-20260712150522-categories-d2b0161e3`

两次发布前检查曾被门禁拦截，均未同步生产文件：

1. 原工作区存在其它任务的未提交改动，`git_clean` 失败。
2. 干净 detached worktree 没有 upstream，`git_pushed` 失败。

最终发布使用干净、已绑定远端提交的工作树，未使用 `--allow-dirty` 或未推送例外。

