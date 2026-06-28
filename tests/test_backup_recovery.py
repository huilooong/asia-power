"""Tests for backup and recovery."""

import json
import tempfile
import unittest
from pathlib import Path

from audit.logger import reconfigure_audit_dir
from safety.recovery import (
    BACKUPS_ROOT,
    create_backup,
    dry_run_restore,
    list_backups,
    reconfigure_backups_root,
    restore_backup,
)


class BackupRecoveryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        reconfigure_backups_root(root / "backups")
        reconfigure_audit_dir(root / "audit")

        # Minimal tree under fake project root — patch via creating dirs in tmp
        for name in ("constitution", "memory", "runtime", "audit"):
            (root / name).mkdir()
            (root / name / "sample.txt").write_text(name, encoding="utf-8")

        # Monkeypatch ROOT in recovery module for backup source
        import safety.recovery as rec
        self._orig_root = rec.ROOT
        rec.ROOT = root
        self.addCleanup(setattr, rec, "ROOT", self._orig_root)

    def test_create_backup(self) -> None:
        dest = create_backup()
        self.assertTrue(dest.is_dir())
        self.assertTrue((dest / "manifest.json").is_file())
        self.assertTrue((dest / "constitution" / "sample.txt").is_file())

    def test_list_backups(self) -> None:
        create_backup()
        items = list_backups()
        self.assertEqual(len(items), 1)

    def test_dry_run_restore(self) -> None:
        dest = create_backup()
        bid = dest.name
        preview = dry_run_restore(bid)
        self.assertIn("DRY RUN", preview)
        self.assertIn("constitution", preview)

    def test_restore_requires_confirm(self) -> None:
        dest = create_backup()
        bid = dest.name
        out = restore_backup(bid, confirm=False)
        self.assertIn("DRY RUN", out)

    def test_restore_with_confirm(self) -> None:
        import safety.recovery as rec
        dest = create_backup()
        bid = dest.name
        (rec.ROOT / "memory" / "sample.txt").write_text("changed", encoding="utf-8")
        restore_backup(bid, confirm=True)
        self.assertEqual(
            (rec.ROOT / "memory" / "sample.txt").read_text(encoding="utf-8"),
            "memory",
        )


if __name__ == "__main__":
    unittest.main()
