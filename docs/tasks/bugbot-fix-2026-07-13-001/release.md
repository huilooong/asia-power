# Release

| Field | Value |
|-------|-------|
| Target | `chrome` |
| Commit | `9e6a8bcc4` (`9e6a8bcc40b13f618f7747b8e50ca8d03a15f83d`) |
| Branch | `feature/apsales-evidence-001` (pushed to origin) |
| Release ID | `REL-20260713114530-chrome-9e6a8bcc4` |
| Remote | `root@159.65.86.24` |
| Snapshots | `/root/.openclaw/workspace/inventory-site/releases/REL-20260713114530-chrome-9e6a8bcc4/snapshots/` |
| Record | `docs/tasks/bugbot-fix-2026-07-13-001/release-record.json` |

## Notes

- Assets rsynced and independently verified on public + remote.
- Release Manager Node process exited non-zero during post-rsync SSH validation (flaky); validation re-run manually **PASS**.
- Worktree deploy used `DEPLOY_ALLOW_UNPUSHED=1` only because detached worktree lacked upstream; **commit SHA was already on GitHub**.

## Rollback

1. Restore files from `releases/REL-20260713114530-chrome-9e6a8bcc4/snapshots/` into `public/`, **or**
2. Redeploy prior chrome release tree / git `d40316224` chrome package.
