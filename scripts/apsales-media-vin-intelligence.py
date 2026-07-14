#!/usr/bin/env python3
"""Read-only APSales VIN adapter for WhatsApp media OCR candidates.

Uses AsiaPower Vehicle Intelligence (local knowledge store → NHTSA), never
QXB. The adapter emits a safe, VIN-masked context object for sales-agent.
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


def main() -> int:
    try:
        payload: dict[str, Any] = json.load(sys.stdin)
        vin = re.sub(r"[\s\-_/.:]", "", str(payload.get("vin") or "")).upper()
        if not VIN_RE.fullmatch(vin):
            print(json.dumps({"status": "failed", "error": "invalid_vin_format"}))
            return 0

        snapshot = enrich_from_vin(vin, allow_external=True)
        public = snapshot.to_public_dict()
        print(
            json.dumps(
                {
                    "status": "success" if snapshot.ok else "uncertain",
                    "vehicle": public,
                    "source": "asia_power_vehicle_intelligence",
                    "provider_source": snapshot.provider_source,
                    "verification_status": snapshot.verification_status,
                    "confidence": snapshot.confidence,
                },
                ensure_ascii=False,
            )
        )
    except Exception as exc:
        print(json.dumps({"status": "failed", "error": type(exc).__name__}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
