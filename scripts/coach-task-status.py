#!/usr/bin/env python3
"""Record a reviewed Coach task receipt locally; does not execute or deploy anything."""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from sales_coach.task_status import advance_task, STAGES

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("task_file", type=Path)
    parser.add_argument("stage", choices=STAGES[1:])
    parser.add_argument("--receipt", action="append", default=[], help="field=value, e.g. owner=reviewer")
    args = parser.parse_args()
    receipts = dict(x.split("=", 1) for x in args.receipt)
    print(json.dumps(advance_task(args.task_file, args.stage, **receipts), ensure_ascii=False))
