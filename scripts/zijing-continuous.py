#!/usr/bin/env python3
"""子敬 24/7 连续运行包装器 — 跑完一轮休息 30 分钟再跑，永不停。"""

import sys
import time
import subprocess
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "scripts/apsales-zijing-run.py"
PYTHON = ROOT / ".venv/bin/python3"
INTERVAL = 30 * 60  # 30 分钟


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def run_cycle() -> None:
    log("子敬 轮次开始")
    result = subprocess.run(
        [str(PYTHON), str(SCRIPT), "--max-countries", "3", "--max-drafts", "15"],
        cwd=str(ROOT),
        capture_output=False,
    )
    log(f"子敬 轮次结束 exit={result.returncode}")


if __name__ == "__main__":
    log(f"子敬 连续模式启动 · 间隔 {INTERVAL // 60} 分钟")
    while True:
        try:
            run_cycle()
        except Exception as exc:
            log(f"子敬 轮次异常: {exc}")
        log(f"休息 {INTERVAL // 60} 分钟")
        time.sleep(INTERVAL)
