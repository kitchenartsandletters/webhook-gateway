# Development Plan — Webhook Gateway

## Phase 1: Setup + Beta Release

### ✅ Alpha Setup
- [x] TypeScript scaffold
- [x] Express + dotenv + body-parser
- [x] Supabase service connection
- [x] FastAPI forward stub
- [x] Signature validation placeholder
- [x] Health & test routes
- [x] Initial logging

### ✅ Beta Release Milestones
- [x] Implement full HMAC signature verification
- [x] Filter and validate payload shape
- [x] Full Supabase insert of event + metadata (topic, shop domain, timestamp)
- [x] Forward webhook to FastAPI w/ fallback skip in production
- [x] Verified successful 200 response via curl with signed payload
- [x] Replay endpoint for Supabase webhook logs
- [x] Topic handler integration with schema-aware logic
- [x] GitHub Issue trigger on fulfillment validation failure

## Future Phases
- Retry queue w/ Redis or Supabase task table
- Signed JWT auth to FastAPI
- Shopify bulk webhook test simulator
- Dashboard UI (React) for replay/resend webhooks
- Multi-tenant project support
- Slack error alerting (e.g. invalid HMAC, insert failure)
- File-based logs in /logs for redundancy


## Next Phase: External Webhook Forwarding

We will extend the webhook gateway to support forwarding webhook payloads to external third-party services.

Key considerations:
- Allow per-topic or per-source forwarding configuration
- Use retry with backoff or dead-letter fallback
- Enable visibility into failed or delayed external deliveries
- Optionally sign forwarded requests for downstream validation