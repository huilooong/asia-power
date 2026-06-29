"""Keyword-based agent router (v0.2 — no LLM routing yet)."""

from agents.profile_loader import load_profile

DEFAULT_AGENT = "coo"

# (agent_id, keywords) — first match wins; order matters (more specific first).
ROUTING_RULES: list[tuple[str, tuple[str, ...]]] = [
    (
        "whatsapp",
        (
            "whatsapp", "wa ", "消息", "回复客户", "跟进",
        ),
    ),
    (
        "inventory",
        (
            "库存", "上架", "审核", "listing", "stock", "hc25", "半车", "乘用车", "catalog",
            "supplier upload", "供应商上传",
            # 三国代号:库存 = 赵云(子龙),守资产护家底
            "赵云", "子龙",
        ),
    ),
    (
        "sales",
        (
            "客户", "报价", "quote", "price", "多少钱", "发动机", "engine",
            "g4kd", "g4na", "回复", "buyer", "fob", "cif", "询价",
            # 三国代号:销售 = 鲁肃(子敬),外交促成交易
            "鲁肃", "子敬",
        ),
    ),
    (
        "coo",
        (
            "计划", "部署", "决定", "决策", "战略", "优先级", "agent", "组织",
            "roadmap", "kpi", "运营", "memory", "架构",
            # 三国代号:COO 本体 = 诸葛亮(孔明 / 丞相)
            "孔明", "诸葛亮", "丞相",
        ),
    ),
]


def route_message(message: str) -> str:
    """Return agent id for a user message using simple keyword matching."""
    text = (message or "").lower()

    for agent_id, keywords in ROUTING_RULES:
        for keyword in keywords:
            if keyword.lower() in text:
                return agent_id

    return DEFAULT_AGENT


def route_with_profile(message: str) -> tuple[str, dict]:
    """Route message and load the matching agent profile."""
    agent_id = route_message(message)
    profile = load_profile(agent_id)
    return agent_id, profile
