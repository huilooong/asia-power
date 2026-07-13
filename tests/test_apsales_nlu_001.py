"""APSALES-NLU-001 — Message Understanding + Conversation State tests."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sales_core.commercial_decision import decide_commercial  # noqa: E402
from sales_core.conversation_state import (  # noqa: E402
    apply_dead_loop_guard,
    empty_state,
    record_system_action,
    update_state_from_understanding,
)
from sales_core.message_understanding import understand_message, primary_engine_code  # noqa: E402


def test_understand_2sz():
    u = understand_message("2sz")
    assert primary_engine_code(u) == "2SZ"
    assert u["communicative_act"] == "provide_information"
    assert u["entities"][0]["verification_status"] == "customer_reported"


def test_understand_engine_code_is_2sz():
    u = understand_message(
        "Engine code is 2sz",
        previous_system_action="ask_engine_plate",
        previous_customer_engine="2SZ",
    )
    assert primary_engine_code(u) == "2SZ"
    assert u["is_clarification"] or u["is_answer_to_previous_question"]
    assert u["communicative_act"] in {
        "clarify_information",
        "answer_previous_question",
        "provide_information",
    }


def test_regression_2sz_then_clarify_different_action():
    """Real CEO failure case: must not repeat ask_engine_plate."""
    st = empty_state("wa:test-nlu")
    u1 = understand_message("2sz", conversation_id="wa:test-nlu")
    st = update_state_from_understanding(st, u1)
    d1 = decide_commercial("2sz", prior_state=st, understanding=u1, conversation_id="wa:test-nlu")
    assert d1.claimed_identity.get("engine_code") == "2SZ"
    assert "claimed_engine_code" in d1.known
    # First turn may ask plate
    a1, r1, _ = apply_dead_loop_guard(st, next_best_action=d1.next_best_action, reply=d1.reply)
    st = record_system_action(st, a1, r1)

    u2 = understand_message(
        "Engine code is 2sz",
        conversation_id="wa:test-nlu",
        previous_system_action=a1,
        previous_customer_engine="2SZ",
    )
    st = update_state_from_understanding(st, u2)
    d2 = decide_commercial(
        "Engine code is 2sz",
        prior_state=st,
        understanding=u2,
        conversation_id="wa:test-nlu",
    )
    a2, r2, blocked = apply_dead_loop_guard(st, next_best_action=d2.next_best_action, reply=d2.reply)
    assert a2 != a1, f"repeated action {a1}"
    assert a2 != "ask_engine_plate" or a1 != "ask_engine_plate"
    assert "2SZ" in r2 or "2sz" in r2.lower() or "confirming" in r2.lower() or "Got it" in r2
    assert r2.strip() != r1.strip()
    # Prefer not the isolated plate sentence alone
    if a1 == "ask_engine_plate":
        assert a2 != "ask_engine_plate"
        assert "confirming the engine code as 2SZ" in r2 or "2SZ" in r2


def test_repeat_2sz_blocked():
    st = empty_state("wa:test-nlu-2")
    u1 = understand_message("2sz")
    st = update_state_from_understanding(st, u1)
    d1 = decide_commercial("2sz", prior_state=st, understanding=u1)
    st = record_system_action(st, d1.next_best_action, d1.reply)

    u2 = understand_message("2sz", previous_system_action=d1.next_best_action, previous_customer_engine="2SZ")
    st = update_state_from_understanding(st, u2)
    d2 = decide_commercial("2sz", prior_state=st, understanding=u2)
    a2, r2, _ = apply_dead_loop_guard(st, next_best_action=d2.next_best_action, reply=d2.reply)
    assert a2 != d1.next_best_action
    assert r2.strip() != d1.reply.strip()


def test_no_plate_switches_path():
    st = empty_state("wa:test-nlu-3")
    u1 = understand_message("2sz")
    st = update_state_from_understanding(st, u1)
    d1 = decide_commercial("2sz", prior_state=st, understanding=u1)
    st = record_system_action(st, "ask_engine_plate", d1.reply)

    u2 = understand_message(
        "I don't have the engine plate",
        previous_system_action="ask_engine_plate",
        previous_customer_engine="2SZ",
    )
    assert u2["cannot_provide_plate"]
    st = update_state_from_understanding(st, u2)
    assert "engine_plate" in st["unavailable_evidence"]
    d2 = decide_commercial(
        "I don't have the engine plate",
        prior_state=st,
        understanding=u2,
    )
    a2, _, _ = apply_dead_loop_guard(st, next_best_action=d2.next_best_action, reply=d2.reply)
    assert a2 != "ask_engine_plate"


def test_correction_3sz():
    st = empty_state("wa:test-nlu-4")
    u1 = understand_message("2sz")
    st = update_state_from_understanding(st, u1)
    assert st["customer_reported"]["engine_code"] == "2SZ"
    u2 = understand_message("It is not 2sz, it is 3sz", previous_customer_engine="2SZ")
    assert primary_engine_code(u2) == "3SZ"
    st = update_state_from_understanding(st, u2)
    assert st["customer_reported"]["engine_code"] == "3SZ"


def test_mechanic_said_2sz():
    u = understand_message("My mechanic said it is 2sz")
    assert primary_engine_code(u) == "2SZ"


def test_maybe_2sz_hedged():
    u = understand_message("I am not sure, maybe 2sz")
    assert primary_engine_code(u) == "2SZ"
    assert u["entities"][0]["confidence"] <= 0.55


def test_g4kd_still_works():
    d = decide_commercial("Need G4KD.")
    assert d.claimed_identity.get("engine_code") == "G4KD"
    assert d.next_best_action in {"ask_engine_plate", "ask_engine_photo", "request_manual_review"}


def test_vin_as_alternative_after_plate():
    st = empty_state("wa:test-nlu-vin")
    u1 = understand_message("2sz")
    st = update_state_from_understanding(st, u1)
    st = record_system_action(st, "ask_engine_plate", "Please send a clear engine plate photo.")
    vin = "JN1TANA51U0123456"
    u2 = understand_message(vin, previous_system_action="ask_engine_plate", previous_customer_engine="2SZ")
    st = update_state_from_understanding(st, u2)
    assert st["customer_reported"].get("vin") == vin.upper() or st["known"].get("vin")
    d2 = decide_commercial(vin, prior_state=st, understanding=u2)
    a2, _, _ = apply_dead_loop_guard(st, next_best_action=d2.next_best_action, reply=d2.reply)
    assert a2 != "ask_engine_plate"


def test_photo_offer_after_no_plate():
    u = understand_message("No plate, I can send photo", previous_system_action="ask_engine_plate")
    assert u["cannot_provide_plate"] or u["offers_photo_alternative"]
    assert u["communicative_act"] in {
        "cannot_provide_requested_evidence",
        "send_alternative_evidence",
    }


def test_customer_reported_not_verified():
    st = empty_state("wa:test-nlu-status")
    u = understand_message("2sz")
    st = update_state_from_understanding(st, u)
    assert st["customer_reported"]["engine_code_status"] == "customer_reported"
    assert "2SZ" not in (st.get("verified") or {})


if __name__ == "__main__":
    tests = [v for k, v in list(globals().items()) if k.startswith("test_")]
    failed = 0
    for fn in tests:
        try:
            fn()
            print("PASS", fn.__name__)
        except Exception as exc:
            failed += 1
            print("FAIL", fn.__name__, exc)
    raise SystemExit(1 if failed else 0)
