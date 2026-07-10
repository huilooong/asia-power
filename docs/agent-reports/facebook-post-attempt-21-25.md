# Facebook Post Attempt 21-25

Command:
```
.venv/bin/python3 scripts/fb-group-post-batch.py --gap 12 --max-fail-streak 3 --groups https://www.facebook.com/groups/577777256711972 https://www.facebook.com/groups/659426684167150 https://www.facebook.com/groups/666490098399004 https://www.facebook.com/groups/422933928669107 https://www.facebook.com/groups/1617062581863413
```

Exit code: 1

Stdout:
```json
{
  "ok": false,
  "results": [
    {
      "ok": true,
      "group_url": "https://www.facebook.com/groups/577777256711972",
      "post_url": "https://web.facebook.com/groups/577777256711972?_rdc=1&_rdr",
      "posted_at": "2026-07-05 15:30 UTC"
    },
    {
      "ok": true,
      "group_url": "https://www.facebook.com/groups/659426684167150",
      "post_url": "https://web.facebook.com/groups/659426684167150?_rdc=1&_rdr",
      "posted_at": "2026-07-05 15:31 UTC"
    },
    {
      "ok": true,
      "group_url": "https://www.facebook.com/groups/666490098399004",
      "post_url": "https://web.facebook.com/groups/666490098399004?_rdc=1&_rdr",
      "posted_at": "2026-07-05 15:31 UTC"
    },
    {
      "ok": true,
      "group_url": "https://www.facebook.com/groups/422933928669107",
      "post_url": "https://web.facebook.com/groups/422933928669107?_rdc=1&_rdr",
      "posted_at": "2026-07-05 15:32 UTC"
    },
    {
      "ok": false,
      "group_url": "https://www.facebook.com/groups/1617062581863413",
      "error": "post_failed",
      "page_url": "https://web.facebook.com/groups/1617062581863413?_rdc=1&_rdr"
    }
  ],
  "stopped_early": false,
  "fail_streak_at_stop": 0,
  "finished_at": "2026-07-05 15:32 UTC"
}
```

Stderr:
```

```
