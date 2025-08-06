✅ SYSTEMATIC END-TO-END TEST PLAN

⸻

🧪 1. Health & System Readiness

Goal: Confirm all services are up and endpoints respond.
	•	GET /health → Should return 200 with a health message.
	•	GET /test/ping → Should hit FastAPI stub and return mock response.

⸻

🧪 2. Shopify Webhook Reception & HMAC Validation

Goal: Validate HMAC, parse headers, extract metadata.
	•	POST /webhooks/shopify using:
	•	Valid HMAC → expect 200
	•	Invalid HMAC → expect 401
	•	Confirm topic and shop_domain are extracted correctly.
	•	Confirm raw payload logged in Supabase webhook_logs.

⸻

🧪 3. Topic Handler Logic

Goal: Test schema-aware behavior.
	•	Send test payload for supported topic (e.g., orders/fulfilled)
	•	Confirm handler logs correct values or throws expected errors.
	•	For a fulfillment failure, confirm:
	•	GitHub Issue is created (visible in GitHub)

⸻

🧪 4. Replay Functionality

Goal: Ensure old webhook logs can be reprocessed.
	•	Fetch a webhook log ID from Supabase.
	•	POST /replay/:id → Should:
	•	Invoke topic handler
	•	Re-log the attempt
	•	Respect logic for fulfillment validation

⸻

🧪 5. External Delivery Module

Goal: Confirm outbound delivery to downstream service.
	•	Successful topic (e.g. inventory-levels) triggers:
	•	Signed HMAC payload
	•	Delivery to USED_BOOKS_WEBHOOK_URL
	•	Logged result in external_deliveries (status = success)
	•	Confirm custom headers:
	•	X-Gateway-Signature
	•	X-Retry-Attempt
	•	X-Gateway-Timestamp

⸻

🧪 6. Delivery Failure → Retry Logic

Goal: Confirm failure handling and retry queue.
	•	Force downstream to return 500
	•	Confirm:
	•	Delivery logged as status: failed
	•	next_retry_at populated
	•	Trigger retry:
	•	Call /retry-pending
	•	OR deploy cron worker and wait for it to run
	•	Confirm attempt count increments
	•	Confirm status changes on success

⸻

🧪 7. Delivery Replay

Goal: Manually resend failed delivery.
	•	Find a failed external_delivery log
	•	POST /replay-delivery/:id
	•	Confirm:
	•	New attempt made
	•	replayed = true
	•	Status updated to success or still failed

⸻

🧪 8. Cron Worker (Railway)

Goal: Confirm scheduled retries work.
	•	Deploy worker with retryPendingDeliveries()
	•	Cron triggers every X mins
	•	Confirm:
	•	Logs show retry attempt
	•	Delivery status changes if successful
	•	App exits cleanly (process.exit())

⸻

🧪 9. GitHub Issue Integration (Hard Failures)

Goal: Ensure errors result in GitHub alerts.
	•	Fulfillment webhook with invalid data → 500
	•	Confirm issue is created with:
	•	Title, error message
	•	JSON body
	•	Link to Supabase ID (if available)

⸻

🧪 10. Supabase Storage + Schema Validation

Goal: Confirm database is clean and fully populated.
	•	Inspect:
	•	webhook_logs → topic, domain, timestamps
	•	external_deliveries → retries, status, replayed, next_retry_at
	•	Validate foreign key to event_id works

⸻

🧪 11. Optional Logging Tests

Goal: Validate file-based fallback and log streams.
	•	Confirm logs exist in /logs
	•	Confirm errors are captured in logs
