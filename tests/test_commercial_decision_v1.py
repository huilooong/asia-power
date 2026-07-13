"""APSALES-DECISION-001 — Commercial Decision Rules V1 local tests."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sales_core.commercial_decision import (  # noqa: E402
    apply_channel_policy,
    decide_commercial,
    load_config,
)
from sales_core.vehicle_intelligence import (  # noqa: E402
    VehicleSnapshot,
    build_sales_decision,
    build_whatsapp_reply,
)

FIXED_TRIO = (
    "Long block / complete engine / gearbox?",
    "Quantity?",
    "Destination port?",
)


def _snap(**kwargs):
    defaults = dict(
        vin="JN1TANA51U0123456",
        vin_masked="JN1*****3456",
        ok=True,
        brand="NISSAN",
        model="X-TRAIL",
        year="2018",
        engine_code="",
        verification_status="provider_reported",
        confidence="medium",
        provider_source="nhtsa_vpic",
        knowledge_hit=False,
    )
    defaults.update(kwargs)
    return VehicleSnapshot(**{k: v for k, v in defaults.items() if k in VehicleSnapshot.__dataclass_fields__})


def _assert_no_fixed_trio(reply: str, ask_list: list):
    joined = " | ".join(ask_list) + "\n" + reply
    hits = sum(1 for x in FIXED_TRIO if x.lower() in joined.lower())
    assert hits < 3, f"fixed trio still present: {ask_list!r} / {reply!r}"


def _assert_channel(reply: str):
    assert "Dear Customer" not in reply
    assert "Best regards" not in reply
    assert "APPROVAL_REQUEST" not in reply
    words = len(re.findall(r"[A-Za-z0-9']+", reply))
    assert words <= 65, f"word count {words}: {reply}"
    assert reply.count("?") <= 2


def test_01_first_customer_need_g4kd():
    d = decide_commercial("Need G4KD.")
    assert d.next_best_action in {"ask_engine_plate", "ask_engine_photo", "request_manual_review"}
    assert d.commercial_risk == "high"
    assert d.evidence_confidence < 0.60
    _assert_no_fixed_trio(d.reply, d.ask_list)
    _assert_channel(d.reply)


def test_02_wholesaler_10_g4kd():
    d = decide_commercial("Need 10 G4KD complete engines wholesale.")
    assert d.customer_type == "wholesaler"
    assert d.next_best_action in {"ask_scope", "ask_quantity", "ask_destination", "check_supplier", "prepare_quote"}
    # complete engines => scope known → should not ask_scope
    assert d.next_best_action != "ask_scope"
    _assert_no_fixed_trio(d.reply, d.ask_list)


def test_03_repairer_g4kd_no_evidence():
    d = decide_commercial("Garage: need G4KD for customer car")
    assert d.customer_type == "repairer"
    assert d.next_best_action in {"ask_engine_plate", "ask_engine_photo", "ask_vin"}
    assert "plate" in d.reply.lower() or "photo" in d.reply.lower() or "vin" in d.reply.lower()


def test_04_vin_no_engine_photo():
    snap = _snap(ok=True, brand="HYUNDAI", model="SONATA", year="2015", engine_code="G4KD")
    d = decide_commercial("JN1TANA51U0123456", snapshot=snap)
    assert d.next_best_action in {"ask_scope", "ask_engine_plate", "ask_quantity"}
    assert len(d.ask_list) <= 1
    _assert_no_fixed_trio(d.reply, d.ask_list)


def test_05_vin_photo_conflict():
    snap = _snap(ok=True, engine_code="G4KD")
    d = decide_commercial(
        "VIN says G4KD but plate shows G4KJ conflict",
        snapshot=snap,
        conflict=True,
        plate_engine_code="G4KJ",
    )
    assert d.next_best_action in {"request_manual_review", "ask_engine_plate", "decline_wrong_supply"}
    assert d.commercial_risk == "high"
    assert "mismatch" in d.reply.lower() or "double-check" in d.reply.lower() or "plate" in d.reply.lower()


def test_06_vin_decode_fail():
    snap = _snap(ok=False, brand="", model="", year="", engine_code="", error="needs_manual_review")
    d = decide_commercial("JN1TANA51U0123456", snapshot=snap)
    assert d.next_best_action in {
        "ask_engine_plate",
        "ask_engine_photo",
        "ask_vin_plate",
        "ask_registration",
    }
    assert "Quantity?" not in d.reply
    assert "Destination port?" not in d.reply


def test_07_clear_engine_plate():
    d = decide_commercial("G4KD", plate_evidence=True, plate_engine_code="G4KD")
    assert d.evidence_confidence >= 0.90
    assert d.next_best_action in {"ask_scope", "ask_quantity", "ask_destination", "prepare_quote"}


def test_08_low_confidence_engine_photo():
    d = decide_commercial("maybe G4KD", photo_evidence=True)
    # photo alone boosts but claim still weak without plate match clarity
    assert d.next_best_action in {
        "ask_engine_plate",
        "ask_scope",
        "ask_vin",
        "ask_engine_photo",
        "request_manual_review",
    }


def test_09_no_repeat_scope():
    d = decide_commercial("Need G4KD complete engine", plate_evidence=True, plate_engine_code="G4KD")
    assert d.next_best_action != "ask_scope"
    assert "long block or complete" not in d.reply.lower()


def test_10_no_repeat_quantity():
    d = decide_commercial(
        "Need 2 G4KD complete engines",
        plate_evidence=True,
        plate_engine_code="G4KD",
    )
    assert d.next_best_action != "ask_quantity"
    assert "What quantity" not in d.reply


def test_11_no_repeat_port():
    d = decide_commercial(
        "Need 2 G4KD complete engines to Tema port",
        plate_evidence=True,
        plate_engine_code="G4KD",
    )
    assert d.next_best_action in {"prepare_quote", "check_supplier"}
    assert "Which destination port" not in d.reply


def test_12_best_price_trusted_spec():
    d = decide_commercial(
        "Best price for G4KD complete engine",
        plate_evidence=True,
        plate_engine_code="G4KD",
    )
    assert d.customer_intent in {"price_request", "engine_code_claim"}
    assert d.next_best_action in {"ask_quantity", "ask_destination", "prepare_quote", "ask_scope"}
    assert not re.search(r"\$\s*\d|USD\s*\d", d.reply)


def test_13_best_price_untrusted_spec():
    d = decide_commercial("Best price G4KD")
    assert d.next_best_action in {"ask_engine_plate", "ask_vin", "ask_engine_photo"}
    assert "cannot quote" not in d.reply.lower()


def test_14_high_risk_manual_review():
    d = decide_commercial(
        "Need G4KD",
        plate_evidence=True,
        conflict=True,
        plate_engine_code="G4KJ",
    )
    assert d.human_review_required or d.next_best_action in {
        "request_manual_review",
        "ask_engine_plate",
        "decline_wrong_supply",
    }
    assert d.commercial_risk == "high"


def test_15_confidence_90_advances():
    d = decide_commercial("G4KD", plate_evidence=True, plate_engine_code="G4KD")
    assert d.evidence_confidence >= 0.90
    assert d.next_best_action in {"ask_scope", "ask_quantity", "ask_destination", "prepare_quote"}
    assert d.next_best_action not in {"ask_engine_plate", "ask_engine_photo"}


def test_16_no_fixed_trio_via_vi_bridge():
    snap = _snap(ok=True, engine_code="G4NA")
    result = build_sales_decision(snap, "JN1TANA51U0123456")
    reply = build_whatsapp_reply(result)
    assert len(result.ask_list) <= 1
    _assert_no_fixed_trio(reply, result.ask_list)
    assert result.commercial_decision.get("next_best_action")


def test_17_no_internal_tags():
    dirty = "Hello\nAPPROVAL_REQUEST: yes\nDear Customer\nBest regards\n"
    clean = apply_channel_policy(dirty)
    assert "APPROVAL_REQUEST" not in clean
    assert "Dear Customer" not in clean
    assert "Best regards" not in clean


def test_18_no_unverified_promises():
    for msg in ["Need G4KD", "Best price", "JN1TANA51U0123456"]:
        d = decide_commercial(msg, snapshot=_snap(ok=True) if "JN1" in msg else None)
        low = d.reply.lower()
        assert "in stock" not in low
        assert "guaranteed" not in low
        assert not re.search(r"\$\s*\d", d.reply)


def test_config_thresholds_loaded():
    cfg = load_config()
    assert cfg["confidence"]["advance_min"] == 0.90
    assert cfg["confidence"]["caution_min"] == 0.60


def test_record_shape():
    d = decide_commercial("Need G4KD")
    rec = d.to_dict()
    for key in (
        "decision_id",
        "next_best_action",
        "evidence_confidence",
        "commercial_risk",
        "objective",
        "decision_reason",
        "expected_result",
    ):
        assert key in rec and rec[key] is not None


if __name__ == "__main__":
    tests = [v for k, v in list(globals().items()) if k.startswith("test_")]
    failed = 0
    for fn in tests:
        try:
            fn()
            print(f"PASS {fn.__name__}")
        except Exception as exc:
            failed += 1
            print(f"FAIL {fn.__name__}: {exc}")
    print(json.dumps({"passed": len(tests) - failed, "failed": failed, "total": len(tests)}))
    raise SystemExit(1 if failed else 0)
