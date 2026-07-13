"""APSALES-NLU-002 — scope answer routing + image evidence path."""

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
from sales_core.message_understanding import understand_message  # noqa: E402


def test_complete_engine_without_context_is_new_request():
    u = understand_message("Complete engine")
    assert u["communicative_act"] == "new_request"
    assert u["intent"] == "provide_scope"
    assert any(
        e["type"] == "product_scope" and e["normalized_value"] == "complete_engine"
        for e in u["entities"]
    )


def test_complete_engine_after_ask_scope_is_answer():
    u = understand_message("Complete engine", previous_system_action="ask_scope")
    assert u["communicative_act"] == "answer_previous_question"
    assert u["intent"] == "provide_scope"
    assert u["references_previous_turn"] is True
    assert any(e["normalized_value"] == "complete_engine" for e in u["entities"])


def test_standalone_complete_only_after_ask_scope():
    assert understand_message("complete")["communicative_act"] == "new_request"
    u = understand_message("complete", previous_system_action="ask_scope")
    assert u["communicative_act"] == "answer_previous_question"
    assert any(e["normalized_value"] == "complete_engine" for e in u["entities"])


def test_scenario_2sz_then_complete_engine_advances():
    st = empty_state("wa:nlu002-s1")
    u1 = understand_message("2sz", conversation_id="wa:nlu002-s1")
    st = update_state_from_understanding(st, u1)
    d1 = decide_commercial("2sz", prior_state=st, understanding=u1, conversation_id="wa:nlu002-s1")
    a1, r1, _ = apply_dead_loop_guard(st, next_best_action=d1.next_best_action, reply=d1.reply)
    st = record_system_action(st, a1, r1)
    assert a1 == "ask_scope", a1

    u2 = understand_message(
        "Complete engine",
        conversation_id="wa:nlu002-s1",
        previous_system_action=a1,
        previous_customer_engine="2SZ",
    )
    assert u2["communicative_act"] == "answer_previous_question"
    st = update_state_from_understanding(st, u2)
    assert st["known"].get("product_scope") == "complete_engine"
    d2 = decide_commercial(
        "Complete engine",
        prior_state=st,
        understanding=u2,
        conversation_id="wa:nlu002-s1",
    )
    a2, r2, _ = apply_dead_loop_guard(st, next_best_action=d2.next_best_action, reply=d2.reply)
    assert a2 in {"ask_quantity", "ask_destination", "check_supplier", "prepare_quote"}, a2
    assert a2 not in {"ask_engine_plate", "ask_engine_photo"}
    assert "plate" not in r2.lower() and "photo" not in r2.lower()


def test_scenario_long_block():
    st = empty_state("wa:nlu002-s2")
    u1 = understand_message("2sz")
    st = update_state_from_understanding(st, u1)
    d1 = decide_commercial("2sz", prior_state=st, understanding=u1)
    a1, r1, _ = apply_dead_loop_guard(st, next_best_action=d1.next_best_action, reply=d1.reply)
    st = record_system_action(st, a1, r1)
    u2 = understand_message("Long block", previous_system_action=a1)
    assert u2["communicative_act"] == "answer_previous_question"
    st = update_state_from_understanding(st, u2)
    assert st["known"]["product_scope"] == "long_block"
    d2 = decide_commercial("Long block", prior_state=st, understanding=u2)
    assert d2.next_best_action != "ask_engine_plate"
    assert "product_scope" in d2.known


def test_image_after_ask_plate_does_not_reask():
    st = empty_state("wa:nlu002-s3")
    st = record_system_action(
        st,
        "ask_engine_plate",
        "Please send a clear engine plate photo.",
    )
    st["customer_reported"]["engine_code"] = "2SZ"
    st["known"]["claimed_engine_code"] = "2SZ"
    u = understand_message("", message_type="image", previous_system_action="ask_engine_plate")
    st = update_state_from_understanding(st, u)
    assert st["requested_evidence_received"] is True
    assert st["pending_image_review"] is True
    assert st["customer_reported"].get("customer_result") == "sent_image"
    d = decide_commercial("", prior_state=st, understanding=u, media_type="image")
    a, r, _blocked = apply_dead_loop_guard(st, next_best_action=d.next_best_action, reply=d.reply)
    assert a not in {"ask_engine_plate", "ask_engine_photo"}, a
    low = r.lower()
    assert "received your photo" in low or "review" in low or "quantity" in low
    assert "please send a clear engine plate" not in low


def test_bare_one_without_ask_quantity_is_not_qty_answer():
    u = understand_message("1")
    assert u["communicative_act"] == "new_request"
    assert not any(e["type"] == "quantity" for e in u["entities"])


def test_bare_one_after_ask_quantity_is_answer():
    u = understand_message("1", previous_system_action="ask_quantity")
    assert u["communicative_act"] == "answer_previous_question"
    assert u["intent"] == "provide_quantity"
    assert u["references_previous_turn"] is True
    assert any(e["type"] == "quantity" and e["normalized_value"] == 1 for e in u["entities"])


def test_quantity_phrases_after_ask_quantity():
    for text, expected in [
        ("2 units", 2),
        ("ten pieces", 10),
        ("qty: 3", 3),
    ]:
        u = understand_message(text, previous_system_action="ask_quantity")
        assert u["communicative_act"] == "answer_previous_question", text
        assert any(e["normalized_value"] == expected for e in u["entities"] if e["type"] == "quantity"), text


def test_scenario_2sz_complete_then_one_asks_destination():
    """Regression: 2sz → ask_scope → Complete engine → ask_quantity → 1 → ask_destination."""
    st = empty_state("wa:nlu002-qty")
    u1 = understand_message("2sz", conversation_id="wa:nlu002-qty")
    st = update_state_from_understanding(st, u1)
    d1 = decide_commercial("2sz", prior_state=st, understanding=u1)
    a1, r1, _ = apply_dead_loop_guard(st, next_best_action=d1.next_best_action, reply=d1.reply)
    st = record_system_action(st, a1, r1)
    assert a1 == "ask_scope"

    u2 = understand_message("Complete engine", previous_system_action=a1)
    st = update_state_from_understanding(st, u2)
    d2 = decide_commercial("Complete engine", prior_state=st, understanding=u2)
    a2, r2, _ = apply_dead_loop_guard(st, next_best_action=d2.next_best_action, reply=d2.reply)
    st = record_system_action(st, a2, r2)
    assert a2 == "ask_quantity", a2
    assert "quantity" in r2.lower()

    u3 = understand_message("1", previous_system_action=a2)
    assert u3["communicative_act"] == "answer_previous_question"
    st = update_state_from_understanding(st, u3)
    assert st["known"].get("quantity") == 1
    d3 = decide_commercial("1", prior_state=st, understanding=u3)
    a3, r3, _ = apply_dead_loop_guard(st, next_best_action=d3.next_best_action, reply=d3.reply)
    assert a3 == "ask_destination", a3
    assert "asiapower here" not in r3.lower()
    assert "what do you need" not in r3.lower()
    assert "destination" in r3.lower() or "port" in r3.lower()


def test_tema_after_ask_destination():
    u = understand_message("Tema", previous_system_action="ask_destination")
    assert u["communicative_act"] == "answer_previous_question"
    assert any(e["type"] == "destination_port" for e in u["entities"])
    st = empty_state("wa:nlu002-dest")
    st["known"]["product_scope"] = "complete_engine"
    st["known"]["quantity"] = 1
    st["customer_reported"]["engine_code"] = "2SZ"
    st["known"]["claimed_engine_code"] = "2SZ"
    st = record_system_action(st, "ask_destination", "Destination port?")
    st = update_state_from_understanding(st, u)
    assert st["known"].get("destination_port")
    d = decide_commercial("Tema", prior_state=st, understanding=u)
    assert d.next_best_action != "ask_destination"
    assert "destination_port" in d.known


def test_vin_after_ask_vin():
    vin = "1HGCM82633A004352"
    u = understand_message(vin, previous_system_action="ask_vin")
    assert u["communicative_act"] == "answer_previous_question"
    assert u["intent"] == "provide_vin"
    assert any(e["type"] == "vin" and e["normalized_value"] == vin for e in u["entities"])
