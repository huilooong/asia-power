"""QXB upload tool — APInventory (子龙) one-row upload workflow."""

from __future__ import annotations

import json

from inventory_core import qxb_pipeline
from tools.tool_base import BaseTool, Permission, ToolResult


class QxbUploadTool(BaseTool):
    name = "qxb_upload"
    description = "汽修宝 QXB upload pipeline — inspect/prepare/process one row at a time"
    permission = Permission.WRITE
    requires_approval = False
    default_dry_run = True
    actions = (
        "status", "next", "inspect", "prepare", "process", "preview", "photos", "pick",
        "block", "unblock", "skip", "park", "unpark", "parked",
        "check-upload", "reupload", "audit",
        "submit-review", "promote", "enrich", "reconcile", "remaining",
    )

    def run(self, action: str, args: list[str], *, dry_run: bool = True) -> ToolResult:
        act = (action or "status").strip().lower()
        ctx = qxb_pipeline.load_context()

        if act == "status":
            summary = qxb_pipeline.queue_summary(ctx)
            return ToolResult(
                ok=True,
                output=qxb_pipeline.format_status_report(summary),
                tool_name=self.name,
                action=act,
                metadata=summary,
            )

        if act == "next":
            row = qxb_pipeline.find_next_row(ctx)
            if row is None:
                return ToolResult(
                    ok=True,
                    output="No pending QXB rows with photos. Check /qxb status.",
                    tool_name=self.name,
                    action=act,
                )
            data = qxb_pipeline.inspect_row(ctx, row)
            return ToolResult(
                ok=data.get("ready", False),
                output=qxb_pipeline.format_inspection_report(data),
                tool_name=self.name,
                action=act,
                metadata={"row": row, **data},
            )

        if act == "inspect":
            if not args:
                return ToolResult(ok=False, output="Usage: qxb_upload inspect <row>", tool_name=self.name, action=act)
            row = int(args[0])
            data = qxb_pipeline.inspect_row(ctx, row)
            return ToolResult(
                ok=data.get("ready", False),
                output=qxb_pipeline.format_inspection_report(data),
                tool_name=self.name,
                action=act,
                metadata=data,
            )

        if act == "prepare":
            if not args:
                return ToolResult(ok=False, output="Usage: qxb_upload prepare <row>", tool_name=self.name, action=act)
            row = int(args[0])
            result = qxb_pipeline.prepare_row(ctx, row)
            if not result.get("ok"):
                insp = result.get("inspection") or {}
                return ToolResult(
                    ok=False,
                    output=qxb_pipeline.format_inspection_report(insp) if insp else str(result),
                    tool_name=self.name,
                    action=act,
                    metadata=result,
                )
            record = result["record"]
            preview = {
                "stockId": record.get("stockId"),
                "brand": record.get("brand"),
                "model": record.get("model"),
                "vin": record.get("vin"),
                "photoLabels": [p.get("label") for p in record.get("photos") or []],
            }
            return ToolResult(
                ok=True,
                output=(
                    f"[DRY RUN] Prepared listing {record.get('stockId')}\n"
                    f"{json.dumps(preview, ensure_ascii=False, indent=2)}\n"
                    f"Full record ready in memory — run process {row} --live after CEO approval."
                ),
                dry_run=True,
                tool_name=self.name,
                action=act,
                metadata=result,
            )

        if act == "pick":
            if not args:
                return ToolResult(ok=False, output="Usage: qxb_upload pick <row>", tool_name=self.name, action=act)
            row = int(args[0])
            fields = qxb_pipeline.resolve_listing_fields(ctx, row)
            if not fields:
                return ToolResult(ok=False, output=f"Row {row} not found", tool_name=self.name, action=act)
            from inventory_core.qxb_photo_pick import format_pick_report
            out = format_pick_report(row, fields["picks"], fields.get("photo_pick_meta") or {})
            return ToolResult(ok=True, output=out, tool_name=self.name, action=act)

        if act in ("preview", "photos"):
            if not args:
                return ToolResult(
                    ok=False,
                    output="Usage: qxb_upload preview <row> [--all]",
                    tool_name=self.name,
                    action=act,
                )
            row = int(args[0])
            include_all = "--all" in [a.lower() for a in args[1:]]
            open_folder = "open-folder" in [a.lower() for a in args[1:]]
            data = qxb_pipeline.preview_row_photos(
                ctx, row, open_browser=not open_folder, include_all=include_all,
            )
            if open_folder and data.get("ok"):
                folder = qxb_pipeline.open_photo_folder(ctx, row)
                if folder:
                    data["folder"] = folder
            out = qxb_pipeline.format_photo_preview_report(data)
            if data.get("folder"):
                out += f"\nFinder folder: {data['folder']}"
            return ToolResult(
                ok=data.get("ok", False),
                output=out,
                tool_name=self.name,
                action=act,
                metadata=data,
            )

        if act == "audit":
            if not args:
                return ToolResult(ok=False, output="Usage: qxb_upload audit <row>", tool_name=self.name, action=act)
            row = int(args[0])
            data = qxb_pipeline.audit_row(ctx, row)
            return ToolResult(
                ok=True,
                output=qxb_pipeline.format_audit_report(data),
                tool_name=self.name,
                action=act,
                metadata=data,
            )

        if act in ("submit-review", "promote"):
            if not args:
                return ToolResult(
                    ok=False,
                    output="Usage: qxb_upload submit-review <row>",
                    tool_name=self.name,
                    action=act,
                )
            row = int(args[0])
            data = qxb_pipeline.submit_row_for_review(ctx, row)
            return ToolResult(
                ok=data.get("ok", False),
                output=qxb_pipeline.format_submit_review_report(data),
                tool_name=self.name,
                action=act,
                metadata=data,
            )

        if act == "enrich":
            if not args:
                return ToolResult(ok=False, output="Usage: qxb_upload enrich <row>", tool_name=self.name, action=act)
            row = int(args[0])
            data = qxb_pipeline.enrich_row_from_vin(ctx, row)
            return ToolResult(
                ok=data.get("ok", False),
                output=qxb_pipeline.format_enrich_report(data),
                tool_name=self.name,
                action=act,
                metadata=data,
            )

        if act == "reupload":
            if not args:
                return ToolResult(
                    ok=False,
                    output="Usage: qxb_upload reupload <row>",
                    tool_name=self.name,
                    action=act,
                )
            row = int(args[0])
            data = qxb_pipeline.prepare_row_reupload(ctx, row)
            return ToolResult(
                ok=True,
                output=(
                    f"Re-upload prep {data.get('stockId')}: "
                    f"removed {data.get('removedApproved')} approved record(s), "
                    f"cleared {data.get('clearedUploadCache')} cached upload(s).\n"
                    f"Next submissionId: {data.get('nextSubmissionId')}\n"
                    "Next: /qxb inspect → preview → process --live approved → submit-review"
                ),
                tool_name=self.name,
                action=act,
                metadata=data,
            )

        if act == "check-upload":
            data = qxb_pipeline.check_upload_auth(ctx.paths)
            return ToolResult(
                ok=data.get("ok", False),
                output=qxb_pipeline.format_upload_auth_report(data),
                tool_name=self.name,
                action=act,
                metadata=data,
            )

        if act == "process":
            if not args:
                return ToolResult(ok=False, output="Usage: qxb_upload process <row> [--live]", tool_name=self.name, action=act)
            live = "--live" in [a.lower() for a in args]
            row_args = [a for a in args if a.lower() != "--live"]
            row = int(row_args[0])
            if live and dry_run:
                return ToolResult(
                    ok=False,
                    output=(
                        f"Live upload for row {row} requires CEO approval.\n"
                        "Dry-run first: /qxb prepare <row>\n"
                        "Then: /tool qxb_upload process <row> --live approved"
                    ),
                    dry_run=True,
                    risk_level="high",
                    tool_name=self.name,
                    action=act,
                )
            result = qxb_pipeline.process_row(ctx, row, dry_run=not live)
            if not result.get("ok"):
                insp = result.get("inspection") or {}
                out = qxb_pipeline.format_inspection_report(insp) if insp else result.get("error", str(result))
                return ToolResult(ok=False, output=out, tool_name=self.name, action=act, metadata=result)
            if not live:
                record = result["record"]
                return ToolResult(
                    ok=True,
                    output=f"[DRY RUN] process row {row} → {record.get('stockId')} ready",
                    dry_run=True,
                    tool_name=self.name,
                    action=act,
                    metadata=result,
                )
            return ToolResult(
                ok=True,
                output=(
                    f"Uploaded row {row} → {result.get('stockId')}\n"
                    f"Approved JSON: {result.get('out')}\n"
                    f"Knowledge: {json.dumps(result.get('knowledge') or {}, ensure_ascii=False)}\n\n"
                    f"{qxb_pipeline.format_audit_report(result.get('audit') or {})}\n\n"
                    f"下一步: {result.get('nextStep') or f'/qxb submit-review {row}'}"
                ),
                dry_run=False,
                risk_level="medium",
                tool_name=self.name,
                action=act,
                metadata=result,
            )

        if act == "block":
            if len(args) < 2:
                return ToolResult(ok=False, output="Usage: qxb_upload block <row> <reason>", tool_name=self.name, action=act)
            row = int(args[0])
            reason = " ".join(args[1:])
            qxb_pipeline.set_row_status(ctx, row, "blocked", issue=reason)
            return ToolResult(ok=True, output=f"Row {row} blocked: {reason}", tool_name=self.name, action=act)

        if act == "unblock":
            if not args:
                return ToolResult(ok=False, output="Usage: qxb_upload unblock <row>", tool_name=self.name, action=act)
            row = int(args[0])
            qxb_pipeline.set_row_status(ctx, row, "pending", clear_issues=True)
            return ToolResult(ok=True, output=f"Row {row} unblocked → pending", tool_name=self.name, action=act)

        if act == "skip":
            if not args:
                return ToolResult(ok=False, output="Usage: qxb_upload skip <row> [reason]", tool_name=self.name, action=act)
            row = int(args[0])
            reason = " ".join(args[1:]) if len(args) > 1 else "skipped by agent"
            qxb_pipeline.set_row_status(ctx, row, "skipped", issue=reason)
            return ToolResult(ok=True, output=f"Row {row} skipped: {reason}", tool_name=self.name, action=act)

        if act == "park":
            if len(args) < 2:
                return ToolResult(
                    ok=False,
                    output="Usage: qxb_upload park <row> <category> [note]\n"
                    f"Categories: {', '.join(qxb_pipeline.PARK_CATEGORIES)}",
                    tool_name=self.name,
                    action=act,
                )
            row = int(args[0])
            category = args[1]
            note = " ".join(args[2:]) if len(args) > 2 else ""
            tier = "easy" if category == "submit_ghost" else "later"
            qxb_pipeline.park_row(ctx, row, category=category, note=note, tier=tier)
            return ToolResult(
                ok=True,
                output=f"QXB{row:04d} parked [{category}] — {qxb_pipeline.PARK_CATEGORIES.get(category, category)}",
                tool_name=self.name,
                action=act,
            )

        if act == "unpark":
            if not args:
                return ToolResult(ok=False, output="Usage: qxb_upload unpark <row>", tool_name=self.name, action=act)
            row = int(args[0])
            entry = qxb_pipeline.unpark_row(ctx, row)
            return ToolResult(
                ok=True,
                output=f"QXB{row:04d} unparked → {entry.get('status')}",
                tool_name=self.name,
                action=act,
            )

        if act == "parked":
            report = qxb_pipeline.format_parked_report(ctx)
            return ToolResult(
                ok=True,
                output=report,
                tool_name=self.name,
                action=act,
                metadata={"parked": qxb_pipeline.list_parked_rows(ctx)},
            )

        if act == "reconcile":
            data = qxb_pipeline.reconcile_with_server(ctx)
            out_path = qxb_pipeline.ROOT / "reports/qxb-reconcile.json"
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_text(
                json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            report = qxb_pipeline.format_reconcile_report(data)
            return ToolResult(
                ok=data.get("ok", False),
                output=report + f"\n\nSaved: {out_path}",
                tool_name=self.name,
                action=act,
                metadata=data,
            )

        if act == "remaining":
            data = qxb_pipeline.count_remaining_upload_rows(ctx)
            return ToolResult(
                ok=True,
                output=qxb_pipeline.format_remaining_report(data),
                tool_name=self.name,
                action=act,
                metadata=data,
            )

        return ToolResult(ok=False, output=f"Unknown action: {act}", tool_name=self.name, action=act)


TOOL = QxbUploadTool()
