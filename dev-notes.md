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

## Future Phases
- Retry queue w/ Redis or Supabase task table
- Signed JWT auth to FastAPI
- GitHub Issue trigger from webhook content
- Shopify bulk webhook test simulator
- Dashboard UI (React) for replay/resend webhooks
- Multi-tenant project support
- Supabase replay endpoint (Phase 1.5)
- Slack error alerting (e.g. invalid HMAC, insert failure)
- File-based logs in /logs for redundancy
- Schema-aware processing of common webhook topics (orders/paid, products/create, etc.)
