# Webhook Gateway (TypeScript Edition)

## Purpose
Handles incoming Shopify webhooks, logs them to Supabase, and forwards validated payloads to the internal FastAPI backend.

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
- `src/controllers/shopifyController.ts` — HMAC validation + forwarding logic
- `src/services/supabaseService.ts` — Supabase insert helper
- `src/utils/logger.ts` — Flat file logging
- `types/` — Shared TypeScript types

## Test Endpoints
- `GET /health` — readiness check
- `GET /test/ping` — mock FastAPI forwarding

See `dev-notes.md` for project phases.
