#!/usr/bin/env python3
"""APBD 24/7 continuous runner — cycles every 45 minutes, never stops."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

import os
os.environ.setdefault("APBD_RUNNER_INTERVAL_SECONDS", "2700")  # 45 minutes

from agents.apbd.runner import APBDRunner

if __name__ == "__main__":
    runner = APBDRunner()
    runner.run_continuous()
