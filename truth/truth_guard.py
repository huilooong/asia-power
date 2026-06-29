"""Detect business-intelligence queries and reject unsourced numeric claims."""

from __future__ import annotations

import re

_BI_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.I) for p in (
        r"9000\s*条",
        r"\d+\s*条\s*(?:聊天|消息|记录)",
        r"whatsapp\s*历史",
        r"聊天记录",
        r"聊天历史",
        r"学到了什么",
        r"有什么收获",
        r"销售洞察",
        r"sales\s*intelligence",
        r"客户数量",
        r"有效客户",
        r"产品\s*top",
        r"发动机\s*top",
        r"top\s*10",
        r"top10",
        r"g4kd|g4kj|2az|1nz|4d56|1zz",
        r"型号占比",
        r"发动机需求",
        r"国家分布",
        r"nigeria|ghana|togo|kenya|senegal|benin",
        r"报价后.*流失",
        r"24\s*小时.*流失",
        r"成交率",
        r"回复率",
        r"话术效果",
        r"供应商表现",
        r"从历史数据",
        r"过去一年.*错误",
        r"最赚钱",
        r"商业洞察",
        r"数据总结",
        r"分析报告",
        r"conversation\s*db",
        r"会话数",
        r"消息数",
        # APTRUTH-002: broader natural phrasings so data questions never leak to the LLM
        r"哪.{0,4}(?:发动机|型号|引擎|产品|配件|车型)",
        r"(?:发动机|型号|引擎|产品|配件|车型).{0,8}(?:最多|最热|最火|排名|需求|问的人|受欢迎|畅销|爆款)",
        r"(?:最多|最热|最火|最受欢迎|畅销|爆款).{0,8}(?:发动机|型号|产品|配件|车型)",
        r"哪些?\s*国家",
        r"(?:客户|订单|需求|市场).{0,8}(?:国家|地区|来源|分布|来自)",
        r"主要市场|市场分布|来自哪",
        r"销售数据|经营数据|业务数据|运营数据",
        r"看.{0,4}(?:数据|报表|报告)",
        r"转化率|复购|客单价|询盘",
    )
)

_CUSTOMER_ENQUIRY_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.I) for p in (
        r"^do you have\b",
        r"^hi\b.{0,40}\b(engine|gearbox|price)\b",
        r"^hello\b.{0,40}\b(engine|gearbox|price)\b",
        r"客户问.*多少钱",
        r"帮我回复",
        r"quotation\s+for",
        r"need\s+\d+\s+units",
    )
)

_VERIFIED_DATA_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.I) for p in (
        r"多少|几个|几条|占比|比例|排名|top|趋势|提升|下降|流失率|成交率|回复率",
        r"how many|what percent|share of|ranking|growth|churn|conversion",
        r"统计|分布|最多|最少|第一|第二",
    )
)

_UNSOURCED_NUMBER_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\b\d{1,3}(?:\.\d+)?%\b"),
    re.compile(r"占\s*\d{1,3}(?:\.\d+)?%"),
    re.compile(r"提升\s*\d{1,3}(?:\.\d+)?%"),
    re.compile(r"TOP\s*10", re.I),
    re.compile(r"\b\d{3,}\s*(?:个)?(?:会话|聊天|contacts?|conversations?)\b", re.I),
    re.compile(r"成交率提升", re.I),
    re.compile(r"回复率提升", re.I),
)

_SOURCE_MARKERS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.I) for p in (
        r"\bsource\s*:",
        r"数据来源",
        r"data_coverage",
        r"verified",
        r"reports/whatsapp_sales_intelligence",
        r"import_state\.json",
        r"memory/sales_intelligence",
        r"未统计|不能判断|unavailable",
        r"AsiaPower Verified",
    )
)


def is_business_intelligence_query(text: str) -> bool:
    """True when CEO asks about WhatsApp history / sales intelligence stats."""
    msg = (text or "").strip()
    if not msg:
        return False
    if any(p.search(msg) for p in _CUSTOMER_ENQUIRY_PATTERNS):
        return False
    return any(p.search(msg) for p in _BI_PATTERNS)


def requires_verified_data(text: str) -> bool:
    """True when the question asks for counts, ratios, rankings, or trends."""
    msg = (text or "").strip()
    if not msg:
        return False
    if any(p.search(msg) for p in _CUSTOMER_ENQUIRY_PATTERNS):
        return False
    return any(p.search(msg) for p in _VERIFIED_DATA_PATTERNS)


def _has_source_marker(answer: str) -> bool:
    return any(m.search(answer) for m in _SOURCE_MARKERS)


def reject_unsourced_numbers(answer: str) -> tuple[bool, str]:
    """
    Return (rejected, reason).
    rejected=True means the answer must not be sent (unsourced stats).
    """
    body = answer or ""
    if not body.strip():
        return False, ""
    if _has_source_marker(body):
        return False, ""
    for pat in _UNSOURCED_NUMBER_PATTERNS:
        m = pat.search(body)
        if m:
            return True, f"unsourced_stat:{m.group(0)}"
    return False, ""
