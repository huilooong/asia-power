"""APInventory command handling and catalog queries."""

from __future__ import annotations

import re

from agents.profile_loader import load_profile
from config.models import AGENT_MODELS, DEFAULT_MODEL
from config.prompts import build_apinventory_system_prompt
from coo_core.constitution_loader import build_constitution_context_for_agent
from sales_core.platform_supply import extract_product_keywords
from tools import memory_tool
from tools.registry import ToolContext, list_tools, run_tool, run_tool_command

APINVENTORY_COMMANDS = (
    "/help", "/start", "/tools", "/tool", "/catalog", "/inventory",
    "/vin", "/qxb", "/remember", "/recall", "/ping",
)

APINVENTORY_ROUTE_PREFIXES = (
    "/catalog",
    "/inventory",
    "/vin ",
    "/vin",
    "/qxb",
    "/remember",
    "/recall",
    "/tools",
    "/tool ",
    "/help",
    "/start",
)

_INVENTORY_KEYWORDS = (
    "库存", "上架", "审核", "listing", "stock", "hc25", "半车", "乘用车", "catalog",
    "supplier upload", "供应商上传", "发动机", "变速箱", "catalogue",
    "赵云", "子龙", "apinventory",
    "汽修宝", "qxb", "批量上传", "上传任务",
)

_VIN_RE = re.compile(r"\b[A-HJ-NPR-Z0-9]{17}\b", re.I)
_ZILONG_ROW_RE = re.compile(r"子龙\s*0*(\d{1,4})", re.I)
_QXB_STOCK_RE = re.compile(r"qxb\s*0*(\d{1,4})", re.I)
_UPLOAD_OK_RE = re.compile(r"确认|没问题|可以上传|批准|approved", re.I)


def parse_qxb_row(message: str) -> int | None:
    """Extract Excel row from 子龙003 / QXB0003 / row 3 style text."""
    text = (message or "").strip()
    for pattern in (_ZILONG_ROW_RE, _QXB_STOCK_RE, re.compile(r"(?:第|row)\s*0*(\d{1,4})", re.I)):
        m = pattern.search(text)
        if m:
            return int(m.group(1))
    return None


def is_qxb_upload_approval(message: str) -> bool:
    """CEO confirmed preview OK and wants live upload."""
    text = (message or "").strip()
    if not text or not _UPLOAD_OK_RE.search(text):
        return False
    if parse_qxb_row(text) is not None:
        return True
    if any(k in text.lower() for k in ("qxb", "汽修宝")) and "上传" in text:
        return True
    return False


def is_apinventory_command(message: str) -> bool:
    """True for APInventory slash commands."""
    text = (message or "").strip()
    if not text.startswith("/"):
        return False
    lower = text.lower()
    if lower in ("/help", "/start", "/ping"):
        return True
    if text == "/tools" or text.startswith("/tool "):
        return True
    if lower.startswith("/catalog") or lower.startswith("/inventory"):
        return True
    if lower.startswith("/vin"):
        return True
    if lower.startswith("/qxb"):
        return True
    if lower.startswith("/remember") or lower.startswith("/recall"):
        return True
    return False


def is_inventory_natural_language(message: str) -> bool:
    """Route plain-text catalog/stock questions to APInventory."""
    text = (message or "").strip().lower()
    if not text or text.startswith("/"):
        return False
    if _ZILONG_ROW_RE.search(message or ""):
        return True
    if is_qxb_upload_approval(message):
        return True
    if any(k.lower() in text for k in _INVENTORY_KEYWORDS):
        return True
    if _VIN_RE.search(message):
        return True
    if extract_product_keywords(message):
        return any(
            k in text
            for k in ("有没有", "库存", "search", "lookup", "available", "listing", "catalog")
        )
    return False


def is_slash_command(message: str) -> bool:
    return (message or "").strip().startswith("/")


def apinventory_help_text() -> str:
    return (
        "APInventory (赵云/子龙) — 库存与目录 Agent\n"
        "/catalog search <keyword> — 搜索本地目录 JSON\n"
        "/inventory search <keyword> — 同 catalog search\n"
        "/vin <VIN> — VIN 本地缓存查询\n"
        "/qxb status — 汽修宝上传队列总览\n"
        "/qxb next — 检查下一条待处理车辆\n"
        "/qxb inspect <row> — 检查 Excel 行（照片/VIN/阻塞项）\n"
        "/qxb prepare <row> — 预览 listing JSON（不上传）\n"
        "/qxb preview <row> — 浏览器预览上传照片槽位\n"
        "/qxb pick <row> — 显示智能选图结果与置信度\n"
        "/qxb reupload <row> — 清除旧上传记录，准备重传\n"
        "/qxb preview <row> --all — 含 manifest 全部本地图\n"
        "/qxb process <row> — 干跑处理一条\n"
        "/qxb process <row> --live approved — 实际上传（需 CEO 批准）\n"
        "/qxb submit-review <row> — 提交 Admin Pending 审核队列（CEO 二次审核）\n"
        "/qxb enrich <row> — 用 VIN 解码补全发动机/变速箱（已上传记录）\n"
        "/qxb audit <row> — 审计上传落在哪（本地/审核/官网）\n"
        "/qxb check-upload — 检测 SUPPLIER_UPLOAD_KEY 是否被生产站接受\n"
        "/qxb block <row> <原因> | /qxb unblock <row> | /qxb skip <row>\n"
        "/tool qxb_upload <action> — Tool Registry 同上\n"
        "/tool inventory search <keyword> — Tool Registry\n"
        "/remember [category] | <note> — 记录备注\n"
        "/recall <keyword> — 搜索 memory\n"
        "/tools — 可用工具列表\n"
        "/help — 本帮助\n\n"
        "工作方式：一条一条来 — inspect → prepare → process → submit-review；发现问题就 block 并记录。\n"
        "自然语言示例: 库存里有没有 G4KJ？ / 子龙看下一条汽修宝上传\n"
        "上传确认: 子龙003 确认可以上传了 → 自动 live process row 3\n"
        "提交审核: /qxb submit-review 3 → CEO 在 admin/inventory?tab=pending 批准"
    )


def _dispatch_qxb_command(body: str, channel: str) -> str:
    """Route /qxb subcommands to qxb_upload tool."""
    parts = body.split()
    if not parts or parts[0].lower() in ("help", "?"):
        return apinventory_help_text()

    action = parts[0].lower()
    args = parts[1:]
    ctx = ToolContext(source="apinventory", channel=channel)

    if action == "process" and "--live" in [a.lower() for a in args]:
        if "approved" not in [a.lower() for a in args]:
            return (
                "实际上传需要 CEO 批准。\n"
                "用法: /qxb process <row> --live approved\n"
                "（先 /qxb prepare <row> 确认预览）"
            )
        live_args = [a for a in args if a.lower() != "approved"]
        result = run_tool(
            "qxb_upload", "process", live_args,
            ctx=ctx, dry_run=False,
        )
        return result.output

    result = run_tool("qxb_upload", action, args, ctx=ctx)
    return result.output


def _run_catalog_search(keyword: str) -> str:
    kw = (keyword or "").strip()
    if not kw:
        return "Usage: /catalog search <keyword>"
    result = run_tool(
        "inventory", "search", [kw],
        ctx=ToolContext(source="apinventory", channel="cli"),
    )
    return result.output


def _run_vin_lookup(vin: str) -> str:
    v = (vin or "").strip().upper()
    if not v:
        return "Usage: /vin <17-char VIN>"
    result = run_tool(
        "vin", "lookup", [v],
        ctx=ToolContext(source="apinventory", channel="cli"),
    )
    return result.output


def _gather_tool_context(message: str) -> str:
    """Deterministic tool hits for LLM context."""
    parts: list[str] = ["Catalog tool results (read-only):"]
    vins = _VIN_RE.findall(message)
    for vin in vins[:2]:
        parts.append(_run_vin_lookup(vin))
    keywords = extract_product_keywords(message)
    if not keywords:
        tokens = re.findall(r"[A-Za-z0-9]{3,}", message)
        keywords = [t for t in tokens if t.upper() not in ("THE", "AND", "FOR")][:3]
    for kw in keywords[:3]:
        out = _run_catalog_search(kw)
        if "no inventory matches" not in out.lower():
            parts.append(out)
    if len(parts) == 1:
        parts.append("(no catalog/VIN tool hits — say unavailable, do not invent)")
    return "\n".join(parts)


def build_apinventory_query_prompt(message: str, profile: dict) -> str:
    constitution = build_constitution_context_for_agent("apinventory")
    base = build_apinventory_system_prompt(profile)
    tool_ctx = _gather_tool_context(message)
    return (
        f"{constitution}\n\n---\n\n{base}\n\n"
        f"{tool_ctx}\n\n"
        "Reply in Chinese for CEO/internal. Structure:\n"
        "1. 结论（有/无匹配）\n"
        "2. 工具结果摘要（必须引用 source 文件路径）\n"
        "3. 缺失信息或下一步\n"
        "禁止编造库存数量或价格。无匹配就说无数据。"
    )


def dispatch_apinventory_command(message: str, channel: str = "cli") -> str:
    text = (message or "").strip()

    if text.startswith("/help") or text == "/start":
        return apinventory_help_text()

    if text.startswith("/ping"):
        from coo_core.health_check import ping_response
        return ping_response().replace("APCOO Online", "APInventory Online")

    if text == "/tools":
        return list_tools()

    if text.startswith("/tool "):
        body = text[len("/tool "):].strip()
        ctx = ToolContext(source="apinventory", channel=channel)
        return run_tool_command(body, ctx=ctx)

    if text.startswith("/remember"):
        body = text[len("/remember"):].strip()
        if not body:
            return "Usage: /remember [category] | <note>"
        category, _, content = body.partition("|")
        try:
            return memory_tool.remember(
                content.strip() or body,
                category=(category.strip().lower() or "inventory"),
                source="apinventory",
            )
        except ValueError as exc:
            return f"Error: {exc}"

    if text.startswith("/recall"):
        keyword = text[len("/recall"):].strip()
        if not keyword:
            return "Usage: /recall <keyword>"
        return memory_tool.recall(keyword)

    if text.lower().startswith("/vin"):
        body = text[4:].strip()
        return _run_vin_lookup(body)

    if text.lower().startswith("/qxb"):
        body = text[4:].strip()
        return _dispatch_qxb_command(body, channel)

    for prefix in ("/catalog", "/inventory"):
        if text.lower().startswith(prefix):
            body = text[len(prefix):].strip()
            parts = body.split(maxsplit=1)
            action = (parts[0] if parts else "search").lower()
            if action in ("search", "find", "lookup"):
                return _run_catalog_search(parts[1] if len(parts) > 1 else "")
            if action == "help" or not body:
                return apinventory_help_text()
            return _run_catalog_search(body)

    return apinventory_help_text()


def process_inventory_query(message: str, channel: str = "cli") -> str:
    """Natural-language catalog question — tools first, then optional LLM."""
    import os

    from openai import OpenAI

    text = (message or "").strip().lower()

    if is_qxb_upload_approval(message):
        row = parse_qxb_row(message)
        if row is None:
            return (
                "子龙收到上传确认，但未识别行号。\n"
                "请用: /qxb process <row> --live approved\n"
                "或: 子龙003 确认可以上传"
            )
        return _dispatch_qxb_command(f"process {row} --live approved", channel)

    if any(k in text for k in ("汽修宝", "qxb", "下一条", "上传任务", "upload queue")):
        if any(k in text for k in ("下一条", "next", "继续", "下一辆")):
            return _dispatch_qxb_command("next", channel)
        if "状态" in text or "status" in text or "进度" in text:
            return _dispatch_qxb_command("status", channel)
        return (
            _dispatch_qxb_command("status", channel)
            + "\n\n提示：用 /qxb next 检查下一条，或 /qxb inspect <行号> 逐条处理。"
        )

    profile = load_profile("apinventory")
    tool_block = _gather_tool_context(message)

    # Fast path: only tool results when OpenAI unavailable
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return (
            "APInventory 目录查询（只读）\n\n"
            f"{tool_block}\n\n"
            "（未配置 OPENAI_API_KEY，仅返回工具结果。）"
        )

    try:
        client = OpenAI(api_key=api_key, timeout=60.0, max_retries=1)
        model = AGENT_MODELS.get("apinventory", DEFAULT_MODEL)
        system = build_apinventory_query_prompt(message, profile)
        from coo_core.dispatcher import call_openai

        reply = call_openai(client, model, system, message, knowledge_addon="\n")
        memory_tool.log_conversation(
            message, reply, source="apinventory", channel=channel, important=True,
        )
        return reply
    except Exception:
        return (
            "APInventory 目录查询（只读）\n\n"
            f"{tool_block}\n\n"
            "（LLM 暂不可用，以上为工具原始结果。）"
        )
