"""Tests for Constitution Engine loader."""

import tempfile
import unittest
from pathlib import Path

from coo_core import constitution_loader as cl


class ConstitutionLoaderTests(unittest.TestCase):
    def test_version_loads(self) -> None:
        version = cl.load_constitution_version()
        self.assertEqual(version.strip(), "v1.0")

    def test_constitution_includes_mission(self) -> None:
        text = cl.load_constitution()
        self.assertIn("循环资产供应链", text)
        self.assertIn("circular asset supply chain", text.lower())

    def test_build_context_includes_mission(self) -> None:
        ctx = cl.build_constitution_context("apcoo")
        self.assertIn("v1.0", ctx)
        self.assertIn("循环资产供应链", ctx)
        self.assertIn("APCOO-001", ctx)

    def test_role_apcoo_loads(self) -> None:
        role = cl.load_role("apcoo")
        self.assertIn("Chief Operating Officer", role)
        self.assertIn("龙惠", role)

    def test_missing_constitution_file_raises(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "VERSION").write_text("v9.9", encoding="utf-8")
            orig_dir = cl.CONSTITUTION_DIR
            orig_files = cl.CONSTITUTION_FILES
            try:
                cl.CONSTITUTION_DIR = root
                cl.CONSTITUTION_FILES = ("00_company_constitution.md",)
                with self.assertRaises(cl.ConstitutionError) as ctx:
                    cl.load_constitution()
                self.assertIn("00_company_constitution.md", str(ctx.exception))
            finally:
                cl.CONSTITUTION_DIR = orig_dir
                cl.CONSTITUTION_FILES = orig_files

    def test_missing_role_raises(self) -> None:
        with self.assertRaises(cl.ConstitutionError) as ctx:
            cl.load_role("nonexistent_role_xyz")
        self.assertIn("nonexistent_role_xyz", str(ctx.exception))

    def test_agent_role_mapping(self) -> None:
        self.assertEqual(cl.role_id_for_agent("coo"), "apcoo")
        self.assertEqual(cl.role_id_for_agent("apsales"), "apsales")
        self.assertEqual(cl.role_id_for_agent("sales"), "apsales")


if __name__ == "__main__":
    unittest.main()
