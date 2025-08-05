Shopify Webhook
        ↓
✅ Gateway receives, verifies, logs
        ↓
🚀 External Delivery Engine (new)
        ↓
→ Signed POST to downstream service
→ Result logged to Supabase (success or fail)
→ Retry table if failed
→ Manual replay possible
→ GitHub issue if hard failure