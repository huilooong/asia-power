"""CLI: python -m sales_coach [--date YYYY-MM-DD] [--self-improve] [--evidence-summary].

Sales Coach is READ ONLY over production:
- never auto-modifies Prompt
- never auto-modifies Decision
- never mutates Evidence turns (only reads; may write coach markdown reports)
"""

from __future__ import annotations

import argparse
import json
import sys

from sales_coach.config import COACH_READ_ONLY
from sales_coach.evidence import run_evidence_daily_summary
from sales_coach.runtime import run_evening_training
from sales_coach.self_improve import run_self_improve


def main(argv: list[str] | None = None) -> int:
    assert COACH_READ_ONLY is True
    parser = argparse.ArgumentParser(description="AsiaPower Sales Coach (Read Only)")
    parser.add_argument("--date", help="UTC day YYYY-MM-DD")
    parser.add_argument("--stdout", action="store_true")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--no-write", action="store_true")
    parser.add_argument(
        "--self-improve",
        action="store_true",
        help="APSALES-SELF-IMPROVE detectors + proposals (no Prompt change)",
    )
    parser.add_argument(
        "--evidence-summary",
        action="store_true",
        help="APSALES-EVIDENCE-001 daily summary (read-only Evidence)",
    )
    args = parser.parse_args(argv)

    if args.evidence_summary:
        result = run_evidence_daily_summary(args.date, write=not args.no_write)
        if args.json:
            print(
                json.dumps(
                    {
                        "day": result["day"],
                        "turns": result["turns"],
                        "report_path": result["report_path"],
                        "read_only": result["read_only"],
                    },
                    ensure_ascii=False,
                    indent=2,
                )
            )
        if args.stdout or not args.json:
            if args.stdout:
                print(result.get("markdown") or "")
            print(f"Evidence Daily Summary: {result.get('report_path')}")
            print(f"turns={result.get('turns')} read_only={result.get('read_only')}")
        return 0

    if args.self_improve:
        result = run_self_improve(args.date, write=not args.no_write)
        if args.json:
            print(
                json.dumps(
                    {
                        "day": result["day"],
                        "turns": result["turns"],
                        "issue_count": len(result["issues"]),
                        "module_counts": result["module_counts"],
                        "recurring": result["recurring"],
                        "report_path": result["report_path"],
                        "proposals_path": result["proposals_path"],
                    },
                    ensure_ascii=False,
                    indent=2,
                )
            )
        if args.stdout or (not args.json):
            if args.stdout:
                print(result.get("markdown") or "")
            print(f"Self-Improve report: {result.get('report_path')}")
            print(f"Proposals: {result.get('proposals_path')}")
            print(f"Issues: {len(result.get('issues') or [])} | modules={result.get('module_counts')}")
        return 0

    result = run_evening_training(args.date, write=not args.no_write)
    if args.json:
        slim = {k: v for k, v in result.items() if k != "markdown"}
        print(json.dumps(slim, ensure_ascii=False, indent=2))
    if args.stdout:
        print(result.get("markdown") or "")
    if not args.stdout and not args.json:
        print(f"Sales Coach training written: {result.get('report_path')}")
        print(f"Progress: {result.get('todays_progress', {}).get('text')}")
        lessons = result.get("lessons") or []
        for i, lesson in enumerate(lessons, 1):
            print(f"Lesson {i}: {lesson.get('title')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
