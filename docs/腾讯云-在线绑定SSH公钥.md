# 腾讯云 Lighthouse：在线绑定 Mac SSH 公钥

**目的**：让 Mac 能 `ssh root@124.222.191.164` 部署企微回调，**不需要**下载腾讯云私钥 `.pem`。

**实例**：`lhins-kna0x2sk`（上海）· IP `124.222.191.164` · 域名 `asia-power.cn` 已指向该 IP。

---

## 第一步：复制下面整行公钥（可安全分享，不是密码）

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAID1kHCBVAr3CkIcqviQUIdtuAkqNmFeZUDVMFPODcUQh longhui@longdeMacBook-Pro.local
```

> 公钥 = 锁；私钥在 Mac 的 `~/.ssh/id_ed25519`，**不要**发给任何人。

---

## 第二步：腾讯云控制台操作

1. 打开 [腾讯云 Lighthouse 控制台](https://console.cloud.tencent.com/lighthouse/instance)。
2. 找到实例 **lhins-kna0x2sk**（上海），点击进入详情。
3. 进入 **登录** 或 **SSH 密钥** 相关页（名称可能是「登录」「SSH密钥」「密钥」）。
4. 选择 **在线绑定** / **绑定密钥** / **绑定 SSH 密钥**（与「下载私钥」不同，只需粘贴公钥）。
5. 若已有密钥对：选 **绑定已有公钥** 或 **导入公钥**，把上面整行粘贴到公钥框，保存。
6. 若没有：可 **新建密钥** → 选 **使用已有公钥** → 粘贴上面整行 → 再 **绑定到本实例**。
7. **防火墙 / 安全组**：确认 **TCP 22** 对您的办公网络或 `0.0.0.0/0` 放行（Lighthouse 默认模板通常已开 22）。

---

## 第三步：告诉技术「已绑定」

绑定完成后在 Cursor 里说：**已绑定**，技术会重试 SSH 并执行：

```bash
bash /Users/longhui/Desktop/AsiaPower/scripts/deploy-domestic-lighthouse.sh ~/.ssh/id_ed25519
```

---

## 常见问题

| 现象 | 处理 |
|------|------|
| 只有腾讯云生成的公钥、没有 `.pem` | 用本文「在线绑定」粘贴 Mac 公钥即可 |
| `Permission denied (publickey)` | 公钥未绑到该实例，或绑错实例 |
| 连接超时 | 查安全组 22 端口、本机网络 |

证书申请邮箱（部署脚本用）：`289106218@qq.com`
