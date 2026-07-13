# Three-stage Evolution Rule

**目的：** 保证业务不断，同时把成长变成可追溯 Evidence，而不是 Prompt 堆屎山。

---

## Sales Coach（硬边界）

Sales Coach = **Evidence Reader（Read Only）**

- 不得修改任何生产数据  
- 不得自动修改 Prompt  
- 不得自动修改 Decision  
- 每天最多三课；每课必须引用真实 `evidence_id`

---

## 统一三阶段

### 第一次：Live Fix

- **立刻修**，保证客户还能聊、还能成交。  
- 允许：Prompt / Rule / Truth Guard / Channel Policy / Code。  
- Evidence：**尽量**挂 `live_fix`，但 **不得**因 Evidence 未写完而阻塞修复上线。  
- **禁止：** 第一次就加新系统 / 新 Engine / 新目录。

### 第二次：Evidence

- 同一类问题再次出现，或修完后复盘：  
- **完整保存** Customer → Decision → Truth Guard → Reply → CEO → Customer Result → Decision Result。  
- 形成可追溯历史：为什么当初这样改 / 为什么放行 / 为什么阻止。

### 第三次：升级长期能力

仅当同时满足：

1. **真实客户**  
2. **反复证明**（Decision Result = succeeded / failed 有样本）  
3. CEO 确认  

才建议升级到：Sales Decision / Truth Guard / Channel Policy。  
仍走：CEO → Cursor → Release Manager → 生产。

---

## 与三大原则

| 原则 | 规则 |
|------|------|
| Business First | Live Fix 永远可先于 Evidence 完美度 |
| Evidence First | 修完也要留下痕迹 |
| Decision First | 升级的是 Decision/Policy；学 Decision Result，不学 Reply 文风当能力 |

---

## 状态

**规则已建立并写入实现边界。**  
代码级强制 lint（可选）未做 — 非 V1 必需。
