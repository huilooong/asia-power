"""Sales Coach Runtime — Evidence Reader.

READ ONLY (APSALES-EVIDENCE-001):
- Must not modify production data
- Must not auto-modify Prompt
- Must not auto-modify Decision
"""

from __future__ import annotations

__version__ = "1.1.0-evidence-reader"

from sales_coach.config import COACH_READ_ONLY
from sales_coach.runtime import run_evening_training

assert COACH_READ_ONLY is True

__all__ = ["run_evening_training", "COACH_READ_ONLY", "__version__"]
