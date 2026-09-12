# 本机 Cursor 上线指令 · HC250613 / XC60

**给本机 Agent 用（This Computer / 不要选 Cloud）。**  
CEO 已批准。代码已在 GitHub 分支 `cursor/hc250613-jac-s3-truck-mistag-2ec3`。

## 先确认你在 Mac

```bash
hostname
ls ~/Desktop/AsiaPower /Users/longhui/Desktop/AsiaPower
ssh -o BatchMode=yes root@159.65.86.24 'echo SSH_OK'
```

不在 Mac、或 SSH 失败：立刻停，不要部署。

## 上线（只这三条）

```bash
cd /Users/longhui/Desktop/AsiaPower || cd ~/Desktop/AsiaPower
git fetch origin cursor/hc250613-jac-s3-truck-mistag-2ec3
git checkout cursor/hc250613-jac-s3-truck-mistag-2ec3
git pull origin cursor/hc250613-jac-s3-truck-mistag-2ec3
git status   # 必须干净；脏树禁止 --allow-dirty
node scripts/deploy-production.mjs api --yes
node scripts/deploy-production.mjs chrome --yes
node scripts/deploy-production.mjs home --yes
```

## 复验

- HC250613 → `passenger` + Engine Assembly + `passengerPartType=engine`
- HC250581 → `passenger` + Half Cut（Reserved 不变）
- 帅铃 / 跨越新豹 / Hyundai D6CF 仍是卡车

禁止：`--allow-dirty`、force push、删数据、部署 nginx/admin。
