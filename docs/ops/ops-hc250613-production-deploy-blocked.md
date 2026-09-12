# OPS · HC250613 / XC60 生产发布被阻断

**Date:** 2026-09-12  
**Status:** 失败（未上线）  
**Gate:** CEO 已批准；Release Manager 未执行

## 结论

| 项 | 结果 |
|---|---|
| 仓库位置 | Cloud Agent `/workspace`（不是 `~/Desktop/AsiaPower`） |
| 分支 / HEAD | `cursor/hc250613-jac-s3-truck-mistag-2ec3` @ `45b80fe`（已 push，工作树干净） |
| SSH `root@159.65.86.24` | **失败** `Permission denied (publickey)` |
| `deploy-production.mjs api` | **未执行**（无 Release ID） |
| `deploy-production.mjs chrome` | **未执行**（无 Release ID） |
| `deploy-production.mjs home` | **未执行**（无 Release ID） |
| 现网 613 / 581 | 仍是 `truck` / `Driver Cab`，修复未上线 |

## SSH 原文

```
$ ssh -o BatchMode=yes root@159.65.86.24 'echo SSH_OK'
root@159.65.86.24: Permission denied (publickey).
```

本机 `~/.ssh/` 只有 `known_hosts`，没有 `id_rsa` / `id_ed25519` / `*.pem`，也没有 `ssh-agent`。  
生产服务器只接受 publickey。未绕开 Release Manager，未 `--allow-dirty`，未 force push，未删数据。

## Git（可发布，但发不出去）

| 项 | 值 |
|---|---|
| 仓库 | `/workspace`（`github.com/huilooong/asia-power`） |
| `~/Desktop/AsiaPower` | 不存在 |
| fetch / pull | 已对齐 origin，Already up to date |
| HEAD | `45b80fe659d0506a9a25ae7eb1ef58561d0cd882` |
| 含修复提交 | `b42f108` file JAC S3 as engine and XC60 as half-cut；`20b8d3e` keep JAC S3 off the truck shelf |
| 工作树 | 干净，与 origin 同步 |

## 现网 API（发布前 / 仍旧）

公开字段是 `vehicleCategory` / `vehicleCondition` / `passengerPartType`（没有独立的 `category` / `condition` / `ppt` 键）。

| 库存 | vehicleCategory | vehicleCondition | passengerPartType | 期望（未上线） |
|---|---|---|---|---|
| HC250613 | `truck` | `Driver Cab` | `front` | `passenger` + Engine Assembly + `engine` |
| HC250581 | `truck` | `Driver Cab` | `''` | `passenger` + Half Cut |

- `GET /api/half-cuts/public?q=250613`：599 条里命中 HC250613，但仍是卡车驾驶室，不是发动机逻辑。
- 首页 snapshot `assets/home-v4-inventory-snapshot.json` 生成于 2026-07-09，货架上当前没有 613/581；实时目录仍把两者标成卡车驾驶室，`/trucks/` 会继续按卡车展示。

## 第二次尝试（2026-09-12 续）

CEO 要求「用本机 Cursor 开上线任务」。本 Cloud Agent 已看到 Mac 执行器在线：

- `eae70334-70ec-5ebb-8361-7c949d8b2167`
- `~/Desktop/AsiaPower @ longMacBook Pro`
- 空闲、`eligibleForSubagent=true`

但 `Task environment=local` 仍落在这台云 VM（hostname=`cursor`，`privateWorkerId=null`），绑不上去。现网 613/581 仍是 `truck` / `Driver Cab`。

**本机一键指令：** `docs/ops/ops-hc250613-mac-local-deploy.md`

## 下一步

在 **本机 Cursor** 打开 `~/Desktop/AsiaPower`，对话选 **本机 / This Computer**（不要选 Cloud），发「上线」，或在终端执行：

```bash
cd ~/Desktop/AsiaPower
ssh -o BatchMode=yes root@159.65.86.24 'echo SSH_OK'
git fetch origin cursor/hc250613-jac-s3-truck-mistag-2ec3
git checkout cursor/hc250613-jac-s3-truck-mistag-2ec3
git pull origin cursor/hc250613-jac-s3-truck-mistag-2ec3
git status   # 必须干净
node scripts/deploy-production.mjs api --yes
node scripts/deploy-production.mjs chrome --yes
node scripts/deploy-production.mjs home --yes
```

然后复验：

- `https://asia-power.com/api/half-cuts/public/item?stockId=HC250613` → passenger + Engine Assembly + `passengerPartType=engine`
- `https://asia-power.com/api/half-cuts/public/item?stockId=HC250581` → passenger + Half Cut
