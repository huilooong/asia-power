"""Phase 0: LIVE-RULES must document A/B/C/D coach-catchable rules."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIVE = ROOT / "docs" / "zijing-training" / "LIVE-RULES.md"


def test_live_rules_covers_abcd_p0_rules():
    text = LIVE.read_text(encoding="utf-8")
    # A — own number leak
    assert "客户自己的号码" in text or "customer_e164" in text.lower() or "自己的 WhatsApp" in text
    # B — internal staff
    assert "内部同事" in text or "白名单" in text
    # C — currency unit on prices
    assert "货币单位" in text or "裸数字" in text
    assert "USD" in text
    # D — fake verified/checked
    assert "已核实" in text or "I verified" in text or "I checked" in text
    # Sync rule (bridge prompt ↔ this file)
    assert "同步规矩" in text and "bridge.mjs" in text
