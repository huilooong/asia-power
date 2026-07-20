# Featured photo framing — final rule

## Why previous attempts failed

| Attempt | Result |
|---|---|
| 188px + cover | Landscape box crushed portrait truck cabs |
| 280px + contain | Full photo but postage stamp in empty frame |
| 360px + cover landscape | Looked “reverted” — still wrong for portrait stock |

Root cause: inventory photos are **mixed** (e.g. HC250162 = 4:3 landscape, HC250587 = 3:4 portrait). One fixed frame cannot serve both.

## Final rule (v4)

1. Detect photo orientation on load (`data-orient=landscape|portrait`)
2. Landscape → `aspect-ratio: 4/3`, wider cell (~520px)
3. Portrait → `aspect-ratio: 3/4`, narrower cell (~300px)
4. Always `object-fit: cover` so the cell is filled (no letterbox)

No more pendulum between crop-stub and empty-frame.
