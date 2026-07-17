# Engineering Standard 执行诊断（2026-07-17）

**性质：** 只诊断、不改规范、不改代码。  
**对照文件：** `.cursor/rules/asiapower-engineering-standard.mdc` + `docs/architecture/ai-engineering-standard-v1.md`  
**样本窗口：** 约 2026-07-15 → 2026-07-17 的 commits / 实施报告 / 已知事故。

## 结论（先看这里）

| 违规现象 | 分类 | 一句话 |
|---------|------|--------|
| commit `c45c556a9` 标题文不对题 | **没写清楚**（规范未要求 commit message 与内容对齐） | 标准写的是 Completion report 字段，不是 git 标题纪律 |
| LIVE-RULES 未随 bridge prompt 同步 | **没写清楚**（标准未点名 LIVE-RULES） | CEO gate 覆盖「对客 prompt」，但没说手册/规则文件必须同 PR 更新 |
| 改 `components.js`/`config.js` 未 bump 全站 `?v=` | **没写清楚**（`.mdc` 完全未提 cache-bust） | 教训在 MEMORY/ops 笔记里，不在 alwaysApply 规则里 |
| 多份 apsales 任务有实施报告 / docs 记录 | **有照做** | 方案文件里写了「写实施报告」时，完成度明显更高 |
| 生产仍走 Release Manager | **有照做** | 发布门禁（commit→push→deploy）近期基本遵守 |

**总判：** 最近三次「没守住」的主因更接近 **要求没写进 agent 必读规则 / 写得不够可执行**，不是「规则写得很清楚却故意不照做」。解法应优先补检查与方案清单里的硬项，而不是先加长散文规范。

---

## 规范实际写了什么

`.mdc`（alwaysApply）强制项：目录结构、交付物先行、Completion report 六段、UI 预览、范围、CEO gate、Release Manager、预览默认路径、报告路径格式。

**没有写：**

- commit message 必须概括实际 diff
- 改共享 JS/CSS 必须统一 bump HTML `?v=`
- 改销售 prompt 必须同步 `LIVE-RULES.md`（或其它手册）
- 方案文件 / Cursor 实施报告 与 git commit 的对应关系

完整版 `ai-engineering-standard-v1.md` 同样未覆盖上述三条。

---

## 三条事故对照

### 1. Commit message 文不对题 — `c45c556a9`

- **标题：** `Refine AsiaPower memory and coordination workflows`
- **实际：** 新增 `guides/*` SEO 页、改 `js/components.js` / `js/config.js`（Guides 导航/页脚）、SEO 执行报告、字典 JSON 等
- **规范覆盖？** 无。标准要求任务结束写 Completion report，**不**要求 `git commit -m` 与 diff 对齐。
- **分类：** 没写清楚（缺口）+ 工作流习惯（同窗口还出现 `Refactor AsiaPower workflow and memory handling` 等泛化标题）
- **同期对照：** `b39c765b3 Bump shared chrome cache keys for SEO guides`、`550b37a95 Fix guide page eBay layout overrides` 标题清楚——说明 agent **能**写对，缺的是强制约束而不是能力。

### 2. LIVE-RULES 未同步（coach A/B/D）

- **现象：** bridge prompt 修了，手册未同步 → coach 审查看不到类问题（后在 coach closed-loop 阶段补上）。
- **规范覆盖？** CEO gate 写了「AI prompts affecting customer behavior」需 CEO 批准；**未**写「手册/LIVE-RULES 与代码同改」。
- **分类：** 没写清楚。方案若未点名 LIVE-RULES，agent 不会当硬交付物。
- **备注：** 这不是「写了 Completion report 字段却跳过」，而是交付物清单本身缺这一项。

### 3. Cache-bust 未 bump（SEO guides）

- **现象：** `c45c556a9` 改了共享 chrome JS；全站 HTML 仍挂 `auth-nav-once-v2` / `about-type-v2` 等共 8 种 `components.js?v=`；后由 `b39c765b3` 统一为 `seo-guides-20260716`。
- **规范覆盖？** `.mdc` **零提及**。MEMORY.md / 若干 ops 事故文有 cache-bust 教训，但不在 alwaysApply 规则路径上。
- **分类：** 没写清楚（且仅靠人脑记忆必漏）→ 应用机械检查（本批任务 A），不是再写一段「请记得 bump」。

---

## 做得好的对照（说明不是全面失控）

| 项 | 证据 |
|----|------|
| 实施报告追加 | WhatsApp / apsales 方案末尾「Cursor 实施报告」近期有追加 |
| 发布纪律 | `ops(apsales): …` 系列走 Release Manager；dirty 红线仍在 |
| CEO gate 意识 | soft-angle / quote-followup 等对客开关有明确启用记录 |

规律：**方案文件里写成硬交付物的，执行率高；只存在于 MEMORY 或口头教训的，执行率低。**

---

## 解法方向（建议，本报告不实施）

| 若根因是… | 不要先做… | 更该做… |
|-----------|-----------|---------|
| 没写清楚 | 把 `.mdc` 再写长一倍 | 把可机械检查的放进 deploy 校验（cache-bust）；方案模板加 1～2 条清单（LIVE-RULES / commit 标题） |
| 写清楚了没照做 | （当前证据不足） | 复核清单 + Claude 读 diff 门禁（协作笔记 B 已记） |

**暂缓：** 立刻大改 `asiapower-engineering-standard.mdc`。先让 A 的检查上线、观察一轮 SEO/chrome 类任务，再决定是否只加三行硬条款。

---

## 验证依据（本诊断用过）

- `git show c45c556a9 --stat`
- `git grep` @ `c45c556a9`：`components.js?v=` 直方图（auth-nav-once-v2×72、about-type-v2×62 等）
- `.cursor/rules/asiapower-engineering-standard.mdc` 全文
- `docs/architecture/ai-engineering-standard-v1.md` §5–12
