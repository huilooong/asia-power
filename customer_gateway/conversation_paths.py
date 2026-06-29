"""Paths for Conversation Learning Pipeline (APLIVE-004)."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MEMORY_ROOT = ROOT / "memory"
CONVERSATIONS_ROOT = MEMORY_ROOT / "conversations"
RAW_DIR = CONVERSATIONS_ROOT / "raw"
NORMALIZED_DIR = CONVERSATIONS_ROOT / "normalized"
ANALYSIS_DIR = CONVERSATIONS_ROOT / "analysis"
LEARNING_ROOT = MEMORY_ROOT / "learning"
CANDIDATES_DIR = LEARNING_ROOT / "candidates"
APPROVED_DIR = LEARNING_ROOT / "approved"
REJECTED_DIR = LEARNING_ROOT / "rejected"


def ensure_conversation_dirs() -> None:
    for d in (
        RAW_DIR,
        NORMALIZED_DIR,
        ANALYSIS_DIR,
        CANDIDATES_DIR,
        APPROVED_DIR,
        REJECTED_DIR,
    ):
        d.mkdir(parents=True, exist_ok=True)


def reconfigure_paths(base: Path) -> None:
    """Test helper — redirect conversation learning storage."""
    global MEMORY_ROOT, CONVERSATIONS_ROOT, RAW_DIR, NORMALIZED_DIR, ANALYSIS_DIR
    global LEARNING_ROOT, CANDIDATES_DIR, APPROVED_DIR, REJECTED_DIR
    MEMORY_ROOT = base
    CONVERSATIONS_ROOT = base / "conversations"
    RAW_DIR = CONVERSATIONS_ROOT / "raw"
    NORMALIZED_DIR = CONVERSATIONS_ROOT / "normalized"
    ANALYSIS_DIR = CONVERSATIONS_ROOT / "analysis"
    LEARNING_ROOT = base / "learning"
    CANDIDATES_DIR = LEARNING_ROOT / "candidates"
    APPROVED_DIR = LEARNING_ROOT / "approved"
    REJECTED_DIR = LEARNING_ROOT / "rejected"
    ensure_conversation_dirs()
