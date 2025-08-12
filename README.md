# Webhook Gateway (TypeScript Edition)

## Purpose
Handles incoming Shopify webhooks, validates authenticity via HMAC, logs event data (including topic, shop domain, and timestamps) to Supabase, and optionally forwards to an internal FastAPI service. Designed for high reliability, observability, and extendability with support for future replay, retry, and alert workflows.

## Stack
- Node.js (TypeScript)
- Express
- Supabase SDK
- Railway (Deployment)
- GitHub (CI/CD)

## Dev Start
```bash
cp .env.example .env
npm install
npm run dev
```

## Project Structure
- `src/index.ts` — Entrypoint
- `src/routes/webhooks.ts` — Route definitions
- `src/controllers/shopifyController.ts` — HMAC validation, metadata extraction, Supabase logging, forwarding logic
- `src/services/supabaseService.ts` — Supabase insert helper
- `src/utils/logger.ts` — Flat file logging
- `types/` — Shared TypeScript types

## Test Endpoints
- `GET /health` — readiness check
- `GET /test/ping` — mock FastAPI forwarding

## Current Capabilities (Phase 1 Beta)
- ✅ Full HMAC verification for incoming webhook requests
- ✅ Payload logging to Supabase including topic, shop domain, and received timestamp
- ✅ Raw request body handling with `express.raw` middleware
- ✅ Skips FastAPI forwarding logic in production
- ✅ Successfully tested with curl and Shopify-compatible webhook signatures
- ✅ Replay endpoint to reprocess logged webhook payloads
- ✅ GitHub issue trigger for fulfillment errors (with context payload)
- ✅ Schema-aware topic handlers for major webhook types (orders/fulfilled, etc.)

See `dev-notes.md` for project phases.

## Next Phase: External Webhook Delivery

The next development phase will focus on delivering webhook payloads to external third-party services.

Planned features:
- Topic-based or config-driven forwarding rules
- Retry strategy with exponential backoff or failover logging
- Optional HMAC signing of outbound requests
- Visibility into delivery attempts and failures