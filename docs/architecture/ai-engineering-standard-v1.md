# AsiaPower AI Engineering Standard v1.0

**Status:** Active  
**Effective:** 2026-07-05  
**Applies to:** Cursor, Codex, Claude, OpenClaw, GPT, and all future AI agents on AsiaPower

---

This standard applies to **ALL AI agents** working on the AsiaPower project.

Including:

- Cursor
- Codex
- Claude
- OpenClaw
- GPT
- Future AI Agents

All agents must follow these standards.

---

## 1. Standard Directory Structure

Unless a task explicitly requires otherwise, use the following project structure.

```
docs/
├── ops/
├── architecture/
├── seo/
├── previews/
│   ├── seo-010/
│   ├── seo-011/
│   ├── product/
│   └── ...
├── reports/
├── releases/
└── research/

public/
server/
agents/
generator/
knowledge/
scripts/
```

Do not create random folders unless there is a clear engineering reason.

**Note:** Legacy paths such as `docs/cto/` remain readable; new ops reports should use `docs/ops/`.

---

## 2. Every Task Must Define Deliverables

Every task must clearly specify:

- Deliverables
- Output directory
- Expected filenames

**Example:**

```
docs/previews/seo-010/
├── g4kd-v2-preview.html
├── assets/
├── styles.css
└── app.js
```

---

## 3. Always Report Output Location

When a task finishes, always report:

1. Relative path
2. Absolute path (workspace)
3. File tree
4. Local preview URL (if applicable)

**Example**

| Field | Value |
|-------|-------|
| Relative | `docs/previews/seo-010/g4kd-v2-preview.html` |
| Absolute | `<workspace>/docs/previews/seo-010/g4kd-v2-preview.html` |
| Preview | `http://localhost:3000/docs/previews/seo-010/g4kd-v2-preview.html` |

---

## 4. Preview Before Production

Any UI / HTML / UX / Page redesign task must first generate a **Preview**.

```
Specification
    ↓
Preview
    ↓
CEO Review
    ↓
Revision
    ↓
Production Implementation
```

**Never implement production UI before preview approval.**

---

## 5. Documentation Standard

Every completed task should include:

- Purpose
- Files Added
- Files Modified
- Deployment Impact
- Rollback Impact
- Validation Result
- Next Recommended Task

---

## 6. Scope Protection

Do not modify files outside the approved task scope.

If additional files are required: **explain why before changing them.**

---

## 7. Standard Completion Report

Every task ends with:

```
━━━━━━━━━━━━━━━━━━━━━━
Task Status
Completed / Partial / Blocked

Deliverables
Output Paths
Preview URL (if applicable)

Files Added
Files Modified
Validation
Next Recommended Task
━━━━━━━━━━━━━━━━━━━━━━
```

---

## 8. Production Safety Rule

Default workflow:

```
Design → Preview → Review → Implementation → Validation → Deployment
```

**Never deploy first.**

---

## 9. Naming Convention

| Type | Pattern | Example |
|------|---------|---------|
| Reports | `{area}-{nnn}-{slug}.md` | `ops-001-xxx.md`, `seo-010-xxx.md`, `apsales-001-xxx.md` |
| Preview HTML | `{slug}-preview.html` | `g4kd-v2-preview.html` |

---

## 10. Default Output Rule

If the task does not specify an output directory, use:

```
docs/previews/<task-id>/
```

and report the location in the completion report.

---

## 11. CEO Review Gate

The following changes require **CEO approval before deployment**:

- Production deployment
- Website UI redesign
- SEO template changes
- Deploy pipeline
- Infrastructure
- AI prompts affecting customer behavior
- Data model or database structure

```
Design → Preview → CEO Review → Approval → Implementation → Validation → Deployment
```

---

## 12. Release Discipline

No production deployment may bypass the **Release Manager** (OPS-005).

Every deployment must have:

- Release ID
- Backup
- Validation
- Rollback capability

See: `docs/cto/ops-005-release-manager.md` (legacy path) or future `docs/ops/ops-005-release-manager.md`.

---

## 13. Engineering Principle

The objective of every task is not only to complete the requested work. It must also be:

- Maintainable
- Reproducible
- Reviewable
- Safe to deploy
- Easy to roll back
- Scalable for future AI agents

---

## Related

- Cursor rule: `.cursor/rules/asiapower-engineering-standard.mdc`
- Agent workspace: `AGENTS.md` → Engineering Standard section
- Release Manager: `scripts/deploy-production.mjs` + `scripts/lib/release-manager.mjs`
