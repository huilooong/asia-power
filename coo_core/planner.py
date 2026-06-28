"""COO Planner — convert CEO goals into structured execution plans (rule-based v0.3)."""

from __future__ import annotations

from tools import task_tool

# (keyword in goal, template key)
GOAL_PATTERNS: list[tuple[str, str]] = [
    ("vin tool", "vin"),
    ("vin", "vin"),
    ("inventory tool", "inventory"),
    ("inventory", "inventory"),
    ("whatsapp", "whatsapp"),
    ("whats app", "whatsapp"),
]

TASK_TEMPLATES: dict[str, list[dict]] = {
    "vin": [
        {
            "title": "Research VIN decode API options",
            "description": "Compare QXB and alternatives; document auth, rate limits, and cost.",
            "owner_agent": "inventory",
            "priority": "high",
            "tags": ["vin-tool", "research"],
            "phase": "Research",
        },
        {
            "title": "Design VIN Tool interface",
            "description": "Define input/output schema, error handling, and cache strategy.",
            "owner_agent": "coo",
            "priority": "high",
            "tags": ["vin-tool", "design"],
            "phase": "Design",
            "dependencies_hint": ["Research VIN decode API options"],
        },
        {
            "title": "Implement VIN Tool",
            "description": "Build decode function using approved API; integrate with inventory flow.",
            "owner_agent": "inventory",
            "priority": "high",
            "tags": ["vin-tool", "build"],
            "phase": "Build",
        },
        {
            "title": "Test VIN Tool",
            "description": "Unit tests + sample VIN batch; verify against known good decodes.",
            "owner_agent": "inventory",
            "priority": "medium",
            "tags": ["vin-tool", "test"],
            "phase": "Test",
        },
        {
            "title": "Document VIN Tool usage",
            "description": "README section for engineers and supplier upload workflow.",
            "owner_agent": "coo",
            "priority": "medium",
            "tags": ["vin-tool", "docs"],
            "phase": "Review",
        },
    ],
    "inventory": [
        {
            "title": "Define inventory stock schema",
            "description": "Document fields for half-cuts, trucks, machinery; align with tasks.json patterns.",
            "owner_agent": "inventory",
            "priority": "high",
            "tags": ["inventory-tool", "design"],
            "phase": "Design",
        },
        {
            "title": "Implement inventory create/search/update",
            "description": "Core CRUD functions over local JSON; no database yet.",
            "owner_agent": "inventory",
            "priority": "high",
            "tags": ["inventory-tool", "build"],
            "phase": "Build",
        },
        {
            "title": "Add inventory tool tests",
            "description": "unittest coverage for create, search, update, and edge cases.",
            "owner_agent": "inventory",
            "priority": "medium",
            "tags": ["inventory-tool", "test"],
            "phase": "Test",
        },
        {
            "title": "Write inventory tool documentation",
            "description": "API surface, examples, and integration with COO Agent.",
            "owner_agent": "coo",
            "priority": "medium",
            "tags": ["inventory-tool", "docs"],
            "phase": "Review",
        },
    ],
    "whatsapp": [
        {
            "title": "Evaluate WhatsApp API options",
            "description": "Compare Business API vs CRM bridge; note Ghana office workflow.",
            "owner_agent": "whatsapp",
            "priority": "high",
            "tags": ["whatsapp", "research"],
            "phase": "Research",
        },
        {
            "title": "Design message intake workflow",
            "description": "How inbound messages become leads and tasks.",
            "owner_agent": "whatsapp",
            "priority": "high",
            "tags": ["whatsapp", "design"],
            "phase": "Design",
        },
        {
            "title": "Design reply workflow with human approval",
            "description": "Draft → review → send rules; no auto-send in v0.3.",
            "owner_agent": "whatsapp",
            "priority": "urgent",
            "tags": ["whatsapp", "approval"],
            "phase": "Design",
        },
        {
            "title": "Prototype WhatsApp reply drafting",
            "description": "Integrate with Sales Agent templates; log to Memory Tool.",
            "owner_agent": "whatsapp",
            "priority": "medium",
            "tags": ["whatsapp", "build"],
            "phase": "Build",
        },
    ],
    "default": [
        {
            "title": "Research goal and constraints",
            "description": "Gather requirements, existing code, and architecture rules.",
            "owner_agent": "coo",
            "priority": "high",
            "tags": ["plan", "research"],
            "phase": "Research",
        },
        {
            "title": "Design solution approach",
            "description": "Outline components, tools, and file changes; keep scope small.",
            "owner_agent": "coo",
            "priority": "high",
            "tags": ["plan", "design"],
            "phase": "Design",
        },
        {
            "title": "Build implementation",
            "description": "Implement core functionality via tools; no direct file hacks.",
            "owner_agent": "coo",
            "priority": "high",
            "tags": ["plan", "build"],
            "phase": "Build",
        },
        {
            "title": "Add tests",
            "description": "unittest for new tools and COO flows.",
            "owner_agent": "coo",
            "priority": "medium",
            "tags": ["plan", "test"],
            "phase": "Test",
        },
        {
            "title": "COO review and sign-off prep",
            "description": "Run Critic on output; prepare CEO approval summary.",
            "owner_agent": "coo",
            "priority": "medium",
            "tags": ["plan", "review"],
            "phase": "Review",
        },
    ],
}

RISK_TEMPLATES: dict[str, list[str]] = {
    "vin": [
        "API credentials or rate limits may block batch decode.",
        "VIN mapping errors affect catalog accuracy.",
    ],
    "inventory": [
        "Schema drift between approved JSON and tool layer.",
        "Concurrent writes to JSON without locking.",
    ],
    "whatsapp": [
        "Auto-send without approval risks customer trust.",
        "API policy changes or number bans.",
    ],
    "default": [
        "Scope creep beyond local-file architecture.",
        "Skipping tests breaks existing main.py flow.",
    ],
}

REQUIRED_TOOLS: dict[str, list[str]] = {
    "vin": ["memory_tool", "task_tool", "catalog_lookup"],
    "inventory": ["memory_tool", "task_tool", "inventory_tool"],
    "whatsapp": ["memory_tool", "task_tool", "whatsapp_crm"],
    "default": ["memory_tool", "task_tool"],
}


def _detect_template(goal: str) -> str:
    text = goal.lower()
    for keyword, template_key in GOAL_PATTERNS:
        if keyword in text:
            return template_key
    return "default"


def create_plan(goal: str) -> dict:
    """Convert a CEO goal into a structured execution plan."""
    goal = goal.strip()
    template_key = _detect_template(goal)
    task_defs = TASK_TEMPLATES[template_key]
    phases = []
    seen_phases: list[str] = []
    for t in task_defs:
        phase = t.get("phase", "General")
        if phase not in seen_phases:
            seen_phases.append(phase)
            phases.append({"name": phase, "objective": f"Complete {phase.lower()} work for: {goal}"})

    risks = list(RISK_TEMPLATES.get(template_key, RISK_TEMPLATES["default"]))
    tools = list(REQUIRED_TOOLS.get(template_key, REQUIRED_TOOLS["default"]))

    # External APIs or new infra need CEO approval
    approval_required = template_key in {"vin", "whatsapp"} or any(
        w in goal.lower() for w in ("api", "deploy", "production", "external")
    )

    tasks = []
    for t in task_defs:
        tasks.append({
            "title": t["title"],
            "description": t["description"],
            "owner_agent": t["owner_agent"],
            "priority": t["priority"],
            "tags": t.get("tags", []),
            "phase": t.get("phase", "General"),
        })

    return {
        "goal": goal,
        "summary": f"Rule-based plan ({template_key}) with {len(tasks)} tasks across {len(phases)} phases.",
        "phases": phases,
        "tasks": tasks,
        "risks": risks,
        "required_tools": tools,
        "approval_required": approval_required,
        "template": template_key,
    }


def materialize_plan(plan: dict, created_by: str = "coo") -> list[dict]:
    """Create tasks in Task Tool from a plan dict."""
    created: list[dict] = []
    id_by_title: dict[str, str] = {}

    for task_def in plan.get("tasks", []):
        task = task_tool.create_task(
            title=task_def["title"],
            description=task_def.get("description", ""),
            owner_agent=task_def.get("owner_agent", "coo"),
            created_by=created_by,
            priority=task_def.get("priority", "medium"),
            tags=task_def.get("tags", []),
        )
        id_by_title[task["title"]] = task["id"]
        created.append(task)

    return created


def format_plan_output(plan: dict, created_tasks: list[dict] | None = None) -> str:
    """Human-readable plan for CLI display."""
    lines = [
        f"Goal: {plan['goal']}",
        f"Summary: {plan['summary']}",
        f"Approval required: {'yes' if plan.get('approval_required') else 'no'}",
        "",
        "Phases:",
    ]
    for phase in plan.get("phases", []):
        lines.append(f"  - {phase['name']}: {phase.get('objective', '')}")

    lines.extend(["", "Tasks:"])
    for i, task in enumerate(plan.get("tasks", []), start=1):
        lines.append(
            f"  {i}. [{task.get('priority', 'medium').upper()}] "
            f"{task['title']} → {task.get('owner_agent', 'coo')}"
        )

    lines.extend(["", "Risks:"])
    for risk in plan.get("risks", []):
        lines.append(f"  - {risk}")

    lines.extend(["", "Required tools:", ", ".join(plan.get("required_tools", []))])

    if created_tasks:
        lines.extend(["", f"Created {len(created_tasks)} tasks in data/tasks.json:"])
        for t in created_tasks:
            lines.append(f"  - {t['id']}: {t['title']}")

    return "\n".join(lines)
