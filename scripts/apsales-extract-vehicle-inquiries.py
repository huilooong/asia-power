#!/usr/bin/env python3
"""Batch: build memory/sales_intelligence/vehicle_inquiries/ from Conversation DB.

Safe to run manually or on the same cadence as growth autopilot.
Does not send messages or change commercial_decision.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def main() -> int:
    from customer_gateway.vehicle_entity_extractor import run_vehicle_inquiry_extract
    from truth.customer_crm_intelligence import load_customer_crm_data

    extract = run_vehicle_inquiry_extract()
    crm = load_customer_crm_data(contact=None)
    print(json.dumps({"extract": extract, "crm_available": crm.get("available"),
                      "scope": crm.get("scope")}, ensure_ascii=False, indent=2))
    return 0 if extract.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
