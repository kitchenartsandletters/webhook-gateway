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

### 🚀 Beta Release Checklist
- [ ] Implement full HMAC signature verification
- [ ] Filter and validate payload shape
- [ ] Full Supabase insert of event + metadata
- [ ] Forward webhook to FastAPI w/ retry fallback
- [ ] Add Slack alert on critical error
- [ ] Create Supabase event viewer dashboard

## Future Phases
- Retry queue w/ Redis or Supabase task table
- Signed JWT auth to FastAPI
- GitHub Issue trigger from webhook content
- Shopify bulk webhook test simulator
- Dashboard UI (React) for replay/resend webhooks
- Multi-tenant project support
