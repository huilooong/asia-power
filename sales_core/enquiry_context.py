"""Extract stated buyer facts so replies don't re-ask what the customer already said."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# Country → example ports (must not cross-contaminate — Tema is Ghana, not Nigeria)
_COUNTRY_PORT_HINTS: dict[str, list[str]] = {
    "尼日利亚": ["Lagos", "Apapa", "Tin Can", "Onne", "Port Harcourt"],
    "nigeria": ["Lagos", "Apapa", "Tin Can", "Onne", "Port Harcourt"],
    "加纳": ["Tema", "Takoradi"],
    "ghana": ["Tema", "Takoradi"],
    "肯尼亚": ["Mombasa"],
    "kenya": ["Mombasa"],
    "坦桑尼亚": ["Dar es Salaam"],
    "tanzania": ["Dar es Salaam"],
    "科特迪瓦": ["Abidjan"],
    "côte d'ivoire": ["Abidjan"],
    "cote d'ivoire": ["Abidjan"],
    "南非": ["Durban", "Cape Town"],
    "south africa": ["Durban", "Cape Town"],
}

_ENGINE_ACCESSORY_QUESTION_ZH = (
    "配置要求：是否包含变速箱？是否需要发电机、空调压缩机、启动机、点火线圈、节气门等附件"
    "（请列明所需全套附件清单）"
)

_LOGISTICS_PROCESS_ZH = (
    "关于发运节奏，我们的常规流程如下：\n"
    "- 常备发动机：核实货源后，7 个工作日内可运至广州港\n"
    "- 定制拆解：在常备基础上，通常需额外预留 3–7 个工作日"
)

_LOGISTICS_PROCESS_EN = (
    "Typical shipping timeline from our side:\n"
    "- Ready-stock engines: within 7 working days to Guangzhou port after sourcing confirmation\n"
    "- Custom dismantling: usually an additional 3–7 working days on top of the above"
)

_COUNTRY_RE = re.compile(
    r"(尼日利亚|nigeria|加纳|ghana|肯尼亚|kenya|坦桑尼亚|tanzania|南非|south africa|"
    r"塞内加尔|senegal|科特迪瓦|c[ôo]te d.?ivoire|多哥|togo|贝宁|benin|"
    r"喀麦隆|cameroon|乌干达|uganda|刚果|congo|安哥拉|angola|"
    r"阿联酋|uae|迪拜|dubai|沙特|saudi|卡塔尔|qatar|"
    r"中国|china|美国|usa|英国|uk)",
    re.I,
)
_QUANTITY_RE = re.compile(
    r"(\d+)\s*(?:台|个|套|件|units?|pcs?|pieces?|sets?)|"
    r"(?:数量|qty|quantity)\s*[:：]?\s*(\d+)",
    re.I,
)
_PORT_RE = re.compile(
    r"(lagos|apapa|tin can|onne|port harcourt|tema|takoradi|abidjan|mombasa|"
    r"dar es salaam|durban|cape town|"
    r"拉各斯|阿帕帕|特马|蒙巴萨|达累斯萨拉姆)",
    re.I,
)
_SHIP_TO_RE = re.compile(
    r"(?:发货到|运到|发往|destination|ship(?:ping)? to|deliver(?:y)? to|port)\s*[:：]?\s*"
    r"([^\n,，。；;]{2,40})",
    re.I,
)
_PHONE_RE = re.compile(r"(?:\+?\d[\d\s\-]{8,16}\d)")
_PRODUCT_RE = re.compile(
    r"(\d+\s*台\s*(?:丰田\s*)?2\s*az\s*发动机|"
    r"丰田\s*2\s*az\s*发动机|2az\s*发动机|"
    r"g4kj|g4kd|hr15de|hr16de|1nz|2nz|"
    r"丰田[^，,\n]{0,12}发动机|toyota[^,\n]{0,20}engine)",
    re.I,
)


def _normalize_country(name: str) -> str:
    return (name or "").strip()


def port_hint_for_country(country: str) -> str:
    """Return human-readable port examples for the stated country only."""
    key = _normalize_country(country)
    ports = _COUNTRY_PORT_HINTS.get(key) or _COUNTRY_PORT_HINTS.get(key.lower())
    if ports:
        return " / ".join(ports)
    return "请提供具体目的港名称"


@dataclass
class EnquiryFacts:
    product_hint: str = ""
    quantity: str = ""
    destination: str = ""
    destination_port: str = ""
    contact: str = ""
    missing: list[str] = field(default_factory=list)
    is_engine_enquiry: bool = False

    def summary_zh(self) -> str:
        if self.product_hint and self.quantity and self.destination:
            ph = self.product_hint
            if ph.startswith(f"{self.quantity}台"):
                return f"{ph}，发运至 {self.destination}"
            unit = "台" if re.search(r"发动机|engine|机", ph, re.I) else ""
            return f"{ph} {self.quantity}{unit}，发运至 {self.destination}"
        parts: list[str] = []
        if self.product_hint:
            parts.append(self.product_hint)
        if self.quantity:
            parts.append(f"{self.quantity}台")
        if self.destination:
            parts.append(f"发运至 {self.destination}")
        if self.destination_port:
            parts.append(f"目的港 {self.destination_port}")
        return "，".join(parts) if parts else ""

    def missing_labels_zh(self) -> list[str]:
        labels: list[str] = []
        if not self.destination_port and self.destination:
            hints = port_hint_for_country(self.destination)
            labels.append(f"{self.destination}具体目的港（如 {hints} 等）")
        elif not self.destination:
            labels.append("目的国/目的港")
        if self.is_engine_enquiry:
            labels.append(_ENGINE_ACCESSORY_QUESTION_ZH)
        if not self.quantity:
            labels.append("具体数量")
        return labels


def parse_enquiry_facts(message: str, *, product_hint: str = "") -> EnquiryFacts:
    text = (message or "").strip()
    facts = EnquiryFacts(product_hint=product_hint)

    q = _QUANTITY_RE.search(text)
    if q:
        facts.quantity = (q.group(1) or q.group(2) or "").strip()

    dest = _COUNTRY_RE.search(text)
    if dest:
        facts.destination = dest.group(1).strip()

    ship = _SHIP_TO_RE.search(text)
    if ship:
        dest_text = ship.group(1).strip()
        if not facts.destination:
            facts.destination = dest_text.rstrip("。")
        port = _PORT_RE.search(dest_text)
        if port:
            facts.destination_port = port.group(0).strip()

    if not facts.destination_port:
        port = _PORT_RE.search(text)
        if port:
            facts.destination_port = port.group(0).strip()

    phone = _PHONE_RE.search(text)
    if phone:
        facts.contact = phone.group(0).strip()

    prod = _PRODUCT_RE.search(text)
    if prod:
        facts.product_hint = prod.group(0).strip()
    elif product_hint and "[Email]" not in product_hint:
        facts.product_hint = product_hint

    combined = f"{facts.product_hint} {text}"
    facts.is_engine_enquiry = bool(
        re.search(r"发动机|engine|机头|powertrain|2az|g4k", combined, re.I)
    )

    facts.missing = facts.missing_labels_zh()
    return facts


def build_contextual_draft_zh(facts: EnquiryFacts, supply: str) -> str:
    """Human-like Chinese email body (without signature)."""
    ack = facts.summary_zh() or "您的询价"
    lines = [
        "尊敬的客户，您好：",
        "",
        f"感谢来信。我们已收到您的需求：{ack}。",
        "",
        supply,
    ]

    if facts.missing:
        lines.append("")
        lines.append("为尽快出具正式 FOB/CIF 报价，还请确认：")
        for i, item in enumerate(facts.missing, 1):
            lines.append(f"{i}. {item}")

    lines.extend(["", _LOGISTICS_PROCESS_ZH, ""])
    lines.append("确认以上信息后，我们会尽快为您核实货源并回复正式报价方案。")
    lines.extend(["", "此致", "敬礼"])
    return "\n".join(lines)


def build_contextual_draft_en(facts: EnquiryFacts, supply: str, keywords: str) -> str:
    ack = facts.summary_zh() or keywords
    body = (
        f"Thank you for your enquiry. We note your request: {ack}.\n\n"
        f"{supply}\n"
    )
    if facts.missing:
        body += "\nTo prepare an accurate FOB/CIF quote, please confirm:\n"
        for i, item in enumerate(facts.missing, 1):
            body += f"{i}. {item}\n"
    body += f"\n{_LOGISTICS_PROCESS_EN}\n\n"
    body += "Once confirmed, we will check supply and revert with a formal quotation."
    return body


def internal_missing_line(facts: EnquiryFacts) -> str:
    if not facts.missing:
        return "缺失信息：已基本齐全，待核实货源与报价"
    return "缺失信息：" + "、".join(facts.missing)


def sales_reply_rules_addon() -> str:
    """Prompt fragment — avoid robotic templates and geographic errors."""
    base = (
        "Reply intelligence rules:\n"
        "- Acknowledge every fact the buyer already stated; never re-ask quantity/destination they gave.\n"
        "- Port examples MUST match the buyer's country (Tema/Takoradi = Ghana only; never cite Tema for Nigeria).\n"
        "- Nigeria ports: Lagos, Apapa, Tin Can, Onne, Port Harcourt.\n"
        "- We do NOT supply remanufactured (再生) engines — do not ask about reman.\n"
        "- For engines, ask accessory scope: gearbox included? alternator, A/C compressor, starter, "
        "ignition coils, throttle body, and full accessory list.\n"
        "- Do NOT ask buyer 'expected delivery date' — state our process instead: ready-stock engines "
        "to Guangzhou port within 7 working days; custom dismantling adds 3–7 working days.\n"
    )
    try:
        from sales_core.zijing_reply_context import zijing_training_rules_addon

        return base + zijing_training_rules_addon()
    except Exception:
        return base
