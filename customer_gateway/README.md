# Customer Gateway — WhatsApp Sales Intelligence (APAG-001B)

## Principle

**Read Only. Analyze First. Learn First. Improve First. No Auto Reply. No Auto Send.**

从历史中学习，但不要盲目模仿 CEO。目标是建立比当前更高成交率的标准化销售体系。

## Modules

| File | Purpose |
|------|---------|
| `whatsapp_connector.py` | Read-only direct connection interface; send/modify/delete blocked |
| `whatsapp_readonly_sync.py` | `/whatsapp sync --readonly` — normalize messages, `sync_state.json` |
| `whatsapp_importer.py` | Import `.txt` exports (legacy path, still supported) |
| `conversation_parser.py` | Parse timestamps, senders, products, language |
| `message_classifier.py` | Classify enquiry / price / shipping / negotiation / … |
| `sales_performance_analyzer.py` | Funnel, drop-off, CEO reply effectiveness, SOP proposals |
| `customer_profile_builder.py` | Per-customer intelligence profiles |
| `whatsapp_intelligence_report.py` | 《WhatsApp Sales Intelligence Report》中文报告 |
| `gateway_readonly.py` | CLI orchestration, safety, APSales context |

## Data

```
memory/customer_gateway/
├── whatsapp_raw/
├── whatsapp_parsed/
├── customer_profiles/
├── enquiry_patterns/
├── reports/
└── sync_state.json
```

Phone numbers are stored as SHA-256 hashes only (`phone_number_hash`).

## CLI

```bash
python main.py "/whatsapp import path/to/chat.txt"
python main.py "/whatsapp sync --readonly"
python main.py "/whatsapp analyze"
python main.py "/whatsapp report"
python main.py "/customer followups"
python main.py "/customer search G4KJ"
python main.py "/sales customer: Do you have G4KJ engine?"
```

## Environment

```bash
# Optional: folder of WhatsApp .txt exports for direct read-only sync
WHATSAPP_READONLY_EXPORT_DIR=/path/to/exports
```

## Safety (Phase 1)

- `SEND_ENABLED = False` in connector
- `assert_readonly()` blocks send/auto-commit operations
- No modification of original chat files
- APSales outputs drafts only
