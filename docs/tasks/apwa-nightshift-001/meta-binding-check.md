# APWA-NIGHTSHIFT-001 — Meta Binding Check

**范围：** 只检查，不改 +233 广告。

## 已知（生产 Graph）

| 项 | 状态 |
|----|------|
| WhatsApp Cloud 号 | `+86 166 3880 1930` |
| verified_name | AsiaPower |
| WABA | `2429009167504708` |
| App（token） | `1026929409720165` |
| Token 能力 | WhatsApp 消息 / WABA 管理；**不能**读 Ads Manager |

## 无法在本环境确认（需 CEO 打开 Ads Manager）

1. 当前 Facebook Page 名称 / Page ID  
2. 当前 Business Portfolio 名称  
3. 正在跑的广告使用的 WhatsApp 号码（预期 +233）  
4. `+86 166 3880 1930` 是否已连接到**同一** Portfolio / Page（用于「发送 WhatsApp 消息」CTA）  
5. 创建广告时下拉是否出现 +86  

## CEO 检查清单（2 分钟）

1. Meta Business Suite → 账号设置 → WhatsApp 账号 → 确认 +86 显示且连到广告用的 Page  
2. Ads Manager → 新建（或复制）「点击发送 WhatsApp 消息」→ 目的地 → 看能否选 **+86 166 3880 1930**  
3. 若不能：通常缺 **Page ↔ WhatsApp** 连接，或广告账户无该资产权限  

## +233 关系

+233 **不在**当前 Cloud WABA 内。夜班广告应是**复制素材换号码**，不是改现有 +233 广告。
