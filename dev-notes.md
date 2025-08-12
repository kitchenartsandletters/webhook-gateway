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


## NEXT PHASE: External Webhook Forwarding

We will extend the webhook gateway to support forwarding webhook payloads to external third-party services.

Needs:
- raw body forwarding (byte-for-byte) to preserve the original Shopify signature
- Header contract for downstream:
	•	Pass through Shopify headers unchanged:
            X-Shopify-Hmac-Sha256, X-Shopify-Topic, X-Shopify-Shop-Domain
    •   Add gateway provenance + integrity:
            X-Gateway-Signature (HMAC with EXTERNAL_HMAC_SECRET), X-Gateway-Timestamp, X-Gateway-Event-ID (the webhook_logs.id), X-Forwarded-By: webhook-gateway
- Topic→Target routing that includes the Shopify inventory topic → used-books-service endpoint
- Idempotency at downstream: ability to ignore duplicates using X-Gateway-Event-ID
- Downstream verifier choices
- ## store has a dedicated webhook secret, use that instead for clarity
- Start with A (pass-through) and also include the gateway signature for defense in depth. Downstream can verify Shopify HMAC first; if it fails, optionally fall back to verifying the gateway signature.

## CONCRETE INTEGRATION PLAN

1) Gateway: ensure raw-body forwarding (critical)
	•	In externalDeliveryService.ts (or forwarder.ts if that’s the path):
	•	Send the original raw Buffer you already have (the same one used to compute inbound HMAC).
Do not JSON.stringify()—any reserialization breaks Shopify HMAC.
	•	Set headers:
	•	Content-Type: application/json
	•	Pass through: X-Shopify-Hmac-Sha256, X-Shopify-Topic, X-Shopify-Shop-Domain
	•	Add:
X-Gateway-Event-ID: <webhook_logs.id>
X-Gateway-Timestamp: <ISO8601>
X-Gateway-Signature: <base64 HMAC over raw body with EXTERNAL_HMAC_SECRET>
X-Forwarded-By: webhook-gateway

2) Gateway: topic→target routing
	•	Map Shopify topic(s) that the used-books-service expects. Most likely:
inventory_levels/update → USED_BOOKS_WEBHOOK_URL = https://<used-books-service>/webhooks/inventory-levels
	•	Add to routing rules so only relevant topics hit this service (others can be delivered elsewhere or skipped).

3) Used-books-service: accept forwarded requests without code churn
	•	You can leave @router.post("/webhooks/inventory-levels") as-is.
	•	It already does:
	•	raw_body = await request.body()
	•	x-shopify-hmac-sha256 header extraction
	•	HMAC verify using SHOPIFY_API_SECRET
	•	This will pass as long as the gateway forwards the exact raw body and the original header unchanged.

Optional hardening (fast follow)
	•	Also read X-Gateway-Signature and validate with a new EXTERNAL_HMAC_SECRET (shared with gateway).
Order:
	1.	Try Shopify HMAC (preferred).✅
	2.	If fails, try Gateway HMAC (lets you cut over later if needed).
		Implement idempotency:
	    •	Keep a small table of processed X-Gateway-Event-ID values to skip duplicates.

4) Observability & safety
	•	In gateway, always record delivery attempt to external_deliveries with response code/body.
	•	In used-books-service, return 200 promptly; kick heavy work to background (BackgroundTasks) to keep the gateway’s retries clean.
	•	Consider allow-listing gateway IPs (if you can) or requiring the presence of X-Forwarded-By + gateway signature to accept the request.

⸻

Environment + config sanity

Gateway
	•	USED_BOOKS_WEBHOOK_URL=https://<used-books-service-domain>/webhooks/inventory-levels
	•	EXTERNAL_HMAC_SECRET=<strong-random-secret>
	•	Cron worker service in Railway has the same env vars (Supabase creds, EXTERNAL_HMAC_SECRET, etc.)

Used-books-service
	•	Confirm SHOPIFY_API_SECRET matches the store’s webhook secret (or Admin API secret if that’s the intended single key).
	•	(Optional) Add GATEWAY_HMAC_SECRET if you’ll verify X-Gateway-Signature.


## KEY CONSIDERATIONS:
- Allow per-topic or per-source forwarding configuration
- Use retry with backoff or dead-letter fallback
- Enable visibility into failed or delayed external deliveries
- Optionally sign forwarded requests for downstream validation
- Two viable verification models (choose one):

    A) Pass‑through Shopify signature (recommended for now)
        •	Gateway forwards the unchanged raw body and preserves:
        •	X-Shopify-Hmac-Sha256
        •	X-Shopify-Topic
        •	X-Shopify-Shop-Domain
        •	Used-books-service keeps its current HMAC verification code exactly as is.
        •	Add optional gateway provenance:
        •	X-Gateway-Signature (HMAC over the same raw body with EXTERNAL_HMAC_SECRET)
        •	X-Gateway-Timestamp
        •	X-Gateway-Event-ID

    Pros: minimal downstream change; preserves current logic.
    Cons: downstream fully depends on Shopify secret (fine here).

    B) Gateway-signed only (not recommended as a first step)
        •	Gateway re-signs with X-Gateway-Signature and downstream verifies gateway HMAC, not Shopify’s.
        •	You’d change FastAPI to verify against EXTERNAL_HMAC_SECRET instead.

    Pros: isolates downstream from Shopify keys.
    Cons: requires code change now; loses the original Shopify signature trail.

    Recommendation: Start with A (pass-through) and also include the gateway signature for defense in depth. Downstream can verify Shopify HMAC first; if it fails, optionally fall back to verifying the gateway signature.