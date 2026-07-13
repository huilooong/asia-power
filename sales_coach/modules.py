"""Issue module taxonomy for APSALES-SELF-IMPROVE-001."""

from __future__ import annotations

MODULES = (
    "SALES_DECISION",
    "TRUTH_GUARD",
    "REPLY_BUILDER",
    "REPLY_FILTER",
    "KNOWLEDGE_GAP",
    "INTEGRATION_BUG",
)

SEVERITIES = ("P0", "P1", "P2")

LESSON_STATUSES = (
    "NEW",
    "TRAINING",
    "VERIFIED",
    "GRADUATED",
    "REGRESSED",
)

MODULE_HELP = {
    "SALES_DECISION": "意图识别、下一步动作、成交推进、询问顺序、是否报价/跟进",
    "TRUTH_GUARD": "无证据的事实/库存/价格/供应商/物流/兼容/付款/售后承诺",
    "REPLY_BUILDER": "语气、长度、结构、WhatsApp 风格、语言匹配、对话节奏",
    "REPLY_FILTER": "内部标签/调试信息泄漏到客户可见回复",
    "KNOWLEDGE_GAP": "缺产品/兼容/市场/流程知识导致答错或答不出",
    "INTEGRATION_BUG": "Webhook/状态/丢消息/媒体/重复发送/Token/API",
}
