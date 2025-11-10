# BareMeds Integration Documentation

## Overview
This document tracks the BareMeds pharmacy API integration, including architecture, configuration, and operational guidelines.

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│  Edge Function (e.g., test-pharmacy-api)                    │
├─────────────────────────────────────────────────────────────┤
│  1. Get Token: supabase.functions.invoke('baremeds-get-token') │
│  2. Build Payload: createTestOrderPayload(siteId)           │
│  3. Make Request: baremedsFetch(endpoint, payload, token)   │
└─────────────────────────────────────────────────────────────┘
```

### Shared Modules

| Module | Purpose | Location |
|--------|---------|----------|
| `baremedsFetch.ts` | HTTP client with dryRun, logging, monitoring | `supabase/functions/_shared/` |
| `baremedsPayloads.ts` | Standardized payload builders | `supabase/functions/_shared/` |
| `baremedsUtils.ts` | Utilities (URL parsing, retry logic, backoff) | `supabase/functions/_shared/` |
| `baremeds-get-token` | Token retrieval and OAuth handling | `supabase/functions/` |

---

## Configuration

### Environment Variables

```bash
# Base URL for BareMeds API (defaults to staging if not set)
BAREMEDS_API_BASE_URL=https://staging-rxorders.baremeds.com

# For production:
# BAREMEDS_API_BASE_URL=https://prod-rxorders.baremeds.com
```

### Database Schema

**Table: `pharmacy_api_credentials`**
- `credential_type`: `"baremeds_oauth"`
- `credential_key`: JSON containing:
  ```json
  {
    "base_url": "https://staging-rxorders.baremeds.com",
    "email": "pharmacy@example.com",
    "password": "***",
    "site_id": "123"
  }
  ```

**Table: `pharmacies`**
- `api_enabled`: `true`
- `api_auth_type`: `"baremeds"`
- `api_endpoint_url`: Full endpoint URL (e.g., `https://staging-rxorders.baremeds.com/api/site/123/orders`)

---

## Features

### ✅ Implemented

1. **Standardized Token Flow**
   - Centralized OAuth handling in `baremeds-get-token`
   - Automatic credential parsing (handles double-encoding)
   - Token caching and validation

2. **Payload Builder**
   - `createTestOrderPayload(siteId)` - For API testing
   - `createProductionOrderPayload(order, orderLine, siteId)` - For real orders
   - Consistent schema across all functions

3. **DryRun Mode**
   - Query parameter: `?dryRun=true`
   - Logs request without sending
   - Returns mock 200 response for testing

4. **Smart Retry Logic**
   - Only retries 5xx and 429 status codes
   - Exponential backoff (1s → 2s → 4s → 8s)
   - Stops on 4xx errors (client/payload issues)

5. **Monitoring & Alerts**
   - Warns on non-2xx responses
   - Errors on 5xx server issues
   - Sanitizes sensitive data in logs
   - Tracks response times and payload sizes

6. **Utilities**
   - `extractSiteIdFromUrl()` - Parses site_id from various URL formats
   - `isRetryableStatusCode()` - Determines if status is retryable
   - `calculateBackoffDelay()` - Exponential backoff calculation
   - `sanitizeBaremedsResponse()` - Removes sensitive data for logging

---

## Edge Functions Using BareMeds

| Function | Purpose | DryRun Support |
|----------|---------|----------------|
| `test-pharmacy-api` | Send test orders to validate configuration | ✅ Yes |
| `retry-pharmacy-transmission` | Retry failed order transmissions | ❌ No |
| `send-cancellation-to-pharmacy` | Send order cancellations | ❌ No |
| `pharmacy-order-action` | Handle hold/decline actions | N/A (no transmission) |

---

## Testing

### Run Full Test Suite

```bash
# Test all utilities and functions
curl -X POST "https://YOUR-PROJECT.supabase.co/functions/v1/test-baremeds-integration" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"run_all_tests": true}'
```

### Test Specific Pharmacy

```bash
# Test token retrieval and dryRun for a pharmacy
curl -X POST "https://YOUR-PROJECT.supabase.co/functions/v1/test-baremeds-integration" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"pharmacy_id": "your-pharmacy-id", "run_all_tests": true}'
```

### Test DryRun Mode

```bash
# Send test order in dryRun mode (won't hit BareMeds API)
curl -X POST "https://YOUR-PROJECT.supabase.co/functions/v1/test-pharmacy-api?dryRun=true" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"pharmacy_id": "your-pharmacy-id"}'
```

---

## Monitoring

### Key Metrics to Track

1. **Success Rate**
   - Monitor `pharmacy_order_transmissions` table
   - Track `success = true` vs `success = false`

2. **Response Times**
   - Check edge function logs for `[baremedsFetch]` timing entries

3. **Error Patterns**
   - 422 errors: Payload validation issues
   - 401/403 errors: Authentication/authorization failures
   - 500+ errors: BareMeds server issues
   - Timeouts: Network or performance issues

### Alert Conditions

Set up alerts for:
- **Token retrieval failures** (indicates credential issues)
- **Sustained 5xx errors** (BareMeds downtime)
- **High retry counts** (network instability or payload issues)
- **DryRun in production** (accidental test mode)

### Log Search Queries

```sql
-- Failed transmissions in last 24 hours
SELECT * FROM pharmacy_order_transmissions
WHERE success = false 
  AND transmitted_at > NOW() - INTERVAL '24 hours'
ORDER BY transmitted_at DESC;

-- Most common error messages
SELECT error_message, COUNT(*) as count
FROM pharmacy_order_transmissions
WHERE success = false
GROUP BY error_message
ORDER BY count DESC
LIMIT 10;
```

---

## Troubleshooting

### Common Issues

**Issue: 422 Payload Validation Error**
```
Error: "The patient.patient_id field is required. (and 17 more errors)"
```
**Solution:** Check payload structure matches BareMeds API spec. Use dryRun mode to inspect payload before sending.

---

**Issue: Token Retrieval Fails**
```
Error: "BareMeds credentials not found for pharmacy X"
```
**Solution:** 
1. Verify credentials exist in `pharmacy_api_credentials`
2. Check `credential_type = 'baremeds_oauth'`
3. Validate JSON structure (base_url, email, password, site_id)

---

**Issue: 401 Authentication Error**
```
Error: "BareMeds login failed: HTTP 401"
```
**Solution:**
1. Verify credentials are correct
2. Check if password has expired
3. Confirm site_id matches pharmacy account

---

**Issue: Endpoint Returns HTML Instead of JSON**
```
Error: "BareMeds login endpoint returned HTML"
```
**Solution:**
1. Verify base_url is correct
2. Check if endpoint path is `/api/auth/login`
3. Test URL manually in browser/Postman

---

## Rollout Plan

### Phase 1: Testing (Current)
- ✅ Use dryRun mode for all test orders
- ✅ Run integration test suite regularly
- ✅ Monitor logs for payload validation errors

### Phase 2: Pilot (Next)
- Select 1-2 pharmacies for live testing
- Send real test orders (marked with "DO NOT FULFILL")
- Monitor success rates and error patterns
- Collect feedback from pharmacy partners

### Phase 3: Production
- Gradually onboard remaining pharmacies
- Enable automatic order transmission
- Set up production monitoring and alerts
- Document escalation procedures

---

## Support & Contacts

### BareMeds Support
- API Documentation: https://staging-rxorders.baremeds.com/api/docs
- Support Email: support@baremeds.com
- Status Page: (TBD)

### Internal Team
- Integration Owner: (TBD)
- On-Call Engineer: (TBD)
- Escalation Path: (TBD)

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2025-01-XX | 1.0.0 | Initial standardized integration |
| 2025-01-XX | 1.1.0 | Added dryRun mode, smart retry, monitoring |
| 2025-01-XX | 1.2.0 | Added test suite and utilities |

---

## Future Enhancements

- [ ] Webhook support for order status updates
- [ ] Automated credential rotation
- [ ] Per-pharmacy rate limiting
- [ ] Dashboard for real-time monitoring
- [ ] Automated incident response (auto-disable on sustained failures)
- [ ] Support for BareMeds v2 API (if available)
