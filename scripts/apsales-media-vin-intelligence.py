#!/usr/bin/env python3
"""Read-only APSales vehicle adapter for WhatsApp media OCR candidates.

- 17-char VIN → AsiaPower Vehicle Intelligence (store → NHTSA), never QXB
- Japanese FRAME No. / plate facts → structured plate snapshot (no fake NHTSA decode)
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sales_core.vehicle_intelligence import enrich_from_vin

VIN_RE = re.compile(r"^[A-HJ-NPR-Z0-9]{17}$", re.I)
FRAME_RE = re.compile(r"^[A-Z]{2,5}\d{1,3}-\d{6,8}$", re.I)


def _from_plate_facts(payload: dict[str, Any]) -> dict[str, Any]:
    facts = payload.get("plate_facts") if isinstance(payload.get("plate_facts"), dict) else {}
    frame = str(payload.get("vin") or facts.get("frame_no") or "").upper().strip()
    if frame and not FRAME_RE.fullmatch(frame):
        # allow OCR vin field holding frame no
        frame = str(facts.get("frame_no") or "").upper().strip()
    vehicle = {
        "id_type": "jp_frame",
        "frame_no": frame or None,
        "vin": None,
        "vin_masked": None,
        "manufacturer": facts.get("manufacturer"),
        "brand": facts.get("manufacturer"),
        "model_code": facts.get("model_code"),
        "engine_code": facts.get("engine_code"),
        "color": facts.get("color"),
        "trim": facts.get("trim"),
        "ok": bool(frame or facts.get("engine_code") or facts.get("model_code")),
        "source": "nameplate_ocr",
    }
    status = "success" if vehicle["ok"] else "failed"
    return {
        "status": status,
        "vehicle": vehicle,
        "source": "nameplate_ocr",
        "provider_source": "nameplate_ocr",
        "verification_status": "ocr_reported",
        "confidence": "medium" if vehicle["ok"] else "none",
        "error": None if vehicle["ok"] else "no_plate_facts",
    }


def main() -> int:
    try:
        payload: dict[str, Any] = json.load(sys.stdin)
        id_type = str(payload.get("id_type") or "").strip().lower()
        raw = str(payload.get("vin") or "").strip().upper()
        vin17 = re.sub(r"[\s\-_/.:]", "", raw)

        if id_type == "jp_frame" or (FRAME_RE.fullmatch(raw) and not VIN_RE.fullmatch(vin17)):
            print(json.dumps(_from_plate_facts(payload), ensure_ascii=False))
            return 0

        if not VIN_RE.fullmatch(vin17):
            # plate facts may still be useful even without VIN17
            if isinstance(payload.get("plate_facts"), dict):
                print(json.dumps(_from_plate_facts(payload), ensure_ascii=False))
                return 0
            print(json.dumps({"status": "failed", "error": "invalid_vin_format"}))
            return 0

        snapshot = enrich_from_vin(vin17, allow_external=True)
        public = snapshot.to_public_dict()
        reasoning = getattr(snapshot, "vin_reasoning_evidence", None)
        print(
            json.dumps(
                {
                    "status": "success" if snapshot.ok else "uncertain",
                    "vehicle": public,
                    "source": "asia_power_vehicle_intelligence",
                    "provider_source": snapshot.provider_source,
                    "verification_status": snapshot.verification_status,
                    "confidence": snapshot.confidence,
                    "vin_reasoning_evidence": reasoning,
                },
                ensure_ascii=False,
            )
        )
    except Exception as exc:
        print(json.dumps({"status": "failed", "error": type(exc).__name__}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
