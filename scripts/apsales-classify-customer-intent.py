#!/usr/bin/env python3
"""Bridge adapter: expose the Sales Coach canonical intent classifier as JSON."""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sales_coach.detectors import classify_customer_intent


def main() -> None:
    payload = json.load(sys.stdin)
    print(json.dumps({"intent": classify_customer_intent(str(payload.get("text", "")))}))


if __name__ == "__main__":
    main()
