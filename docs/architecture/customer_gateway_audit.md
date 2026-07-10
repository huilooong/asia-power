# Customer Gateway Audit

Audit date: 2026-07-04

## Summary

`customer_gateway/` began as a read-only WhatsApp Sales Intelligence gateway, but now contains email sending, CEO approval, social autopilot, Google Maps scraping, Facebook/X engagement, live dashboards, and customer intelligence. It is the most overloaded module in the repository.

Original principle in `customer_gateway/README.md`: read only, analyze first, learn first, improve first, no auto reply, no auto send.

Current reality: several modules can send email, notify Telegram, post social content, or operate browser automation when called with the right env/config.

## Module Groups

| Group | Files | Responsibility | Status | Risk |
|---|---|---|---|---|
| WhatsApp read-only gateway | `whatsapp_connector.py`, `whatsapp_readonly_sync.py`, `whatsapp_importer.py`, `gateway_readonly.py`, `whatsapp_safety.py` | Read/import/analyze WhatsApp data, block writes | Good conceptual boundary | Medium |
| WhatsApp live/browser | `whatsapp_browser_adapter.py`, `whatsapp_business_*`, `whatsapp_live_*` | Playwright/Business Web read-only polling/listening | Active but complex | High |
| Conversation intelligence | `conversation_*`, `sales_intelligence_*`, `customer_profile_builder.py`, `message_classifier.py`, `sales_message_classifier.py` | Normalize, classify, analyze, profile customers | Valuable but overlapping generations | Medium |
| Draft/approval | `draft_queue.py`, `approval_notification.py`, `ceo_draft_approval.py`, `reply_evolution.py` | Draft lifecycle, Telegram/email approval | Useful but send semantics are inconsistent | High |
| Email gateway | `email_inbound.py`, `email_outbound.py`, `email_proxy_bridge.py`, `email_router.py`, `supplier_email_inbound.py`, `ceo_email_inbox.py`, `email_webhook_handler.py`, `email_test_filter.py` | Email thread intake, routing, outbound replies | Active, duplicated with Node email server | Critical |
| Growth prospecting | `maps_prospect.py`, `africa_maps_prospect.py`, `outreach_engine.py`, `outreach_copy.py`, `growth_autopilot.py` | Maps leads, outreach queue, growth batching | Active/experimental | High |
| Social automation | `social_api.py`, `social_autopilot.py`, `social_engagement_engine.py`, `social_post_assets.py`, `social_session.py`, `fb_platform_limits.py` | Official API/browser social posting, queue, sessions, limits | Active but policy-sensitive | Critical |
| Zijng live ops | `distribution_progress.py`, `zijing_activity_stream.py`, `zijing_routing.py`, `zijing_terminal_view.py` | Progress tracking, routing, status dashboards | Useful but tightly coupled to growth | Medium |
| Knowledge helpers | `sales_knowledge.py`, `customer_memory_rules.py`, `reply_style_learner.py`, `contact_role_classifier.py` | Sales knowledge and memory eligibility | Valuable | Low |

## Valuable Capabilities

- Read-only WhatsApp import and analysis.
- Customer profile and sales intelligence generation.
- Draft queue with explicit approval state.
- Email routing by mailbox/agent.
- Contact/lead enrichment and outreach candidate generation.
- Social session state tracking and platform limit handling.
- Maps lead collection with progress state.

## Boundary Problems

1. Read-only and outbound code live in the same package. A future change can accidentally call send-capable paths from analysis paths.
2. Python email modules duplicate Node email modules. Node handles `/api/email/inbound` and `/api/email/send`; Python handles approval and outbound Resend too.
3. `approval` is overloaded. In WhatsApp, approve means approving a draft, not sending. In email, CEO reply can auto-send.
4. Growth code stores operational state under `memory/customer_gateway`, mixing durable memory, queue state, sessions, and logs.
5. Browser automation and official API posting coexist without a clear platform abstraction contract.
6. Telegram notifications are imported from many places rather than centralized through one notification gateway.

## Files Needing Special Control

- Critical: `ceo_draft_approval.py`, `email_outbound.py`, `social_api.py`, `social_autopilot.py`, `social_engagement_engine.py`.
- High: `africa_maps_prospect.py`, `maps_prospect.py`, `outreach_engine.py`, `distribution_progress.py`, `whatsapp_business_web_connector.py`.
- Medium: `draft_queue.py`, `approval_notification.py`, `growth_autopilot.py`, `zijing_routing.py`.

## Recommended Refactor Boundary

Split `customer_gateway` into explicit packages:

- `customer_intelligence/`: read-only ingestion, normalization, analysis, profiles.
- `customer_drafts/`: draft generation, approval state, templates.
- `email_gateway/`: inbound/outbound email, but with a single Node/Python owner.
- `growth_engine/`: maps/social/email lead generation, queue only.
- `social_integrations/`: API/browser adapters only, no business decisions.
- `ops_status/`: Zijng dashboard, progress summaries.

Until that split exists, do not add new features to `customer_gateway/`.

