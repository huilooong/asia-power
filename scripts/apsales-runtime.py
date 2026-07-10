#!/usr/bin/env python3
"""APSales production runtime CLI."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from apsales_runtime.service import main

if __name__ == "__main__":
    raise SystemExit(main())
