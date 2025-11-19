# SECRET ROTATION PROCEDURES

**Document Version:** 1.0  
**Last Updated:** 2025-11-19  
**Owner:** VitaLuxe Services Security Team

---

## OVERVIEW

This document defines the procedures for rotating all secrets used in the VitaLuxe Services application to maintain security and compliance.

---

## ROTATION SCHEDULE

### Quarterly (Every 90 Days)
- Twilio API credentials
- Agora video credentials
- Authorize.Net API credentials
- Postmark API keys
- GoHighLevel webhook secrets

### Annually (Every 365 Days)
- Supabase Service Role Key
- Admin IP allowlist review
- CRON secrets for penetration testing

### On Demand
- Any secret suspected of being compromised
- After team member departure with access to secrets
- After security incident

---

## 1. TWILIO CREDENTIALS

### Secrets to Rotate
- `TWILIO_ACCOUNT_SID` (identifier, low risk but should rotate)
- `TWILIO_AUTH_TOKEN` (high risk)

### Rotation Procedure

**Step 1: Generate New Token**
1. Log in to [Twilio Console](https://www.twilio.com/console)
2. Navigate to Account → Settings → API Credentials
3. Click "Create new Auth Token"
4. Copy the new token immediately (shown only once)

**Step 2: Update Supabase Secrets**
1. Open Lovable project → Backend
2. Navigate to Edge Functions → Secrets
3. Update `TWILIO_AUTH_TOKEN` with new value
4. Keep old token active during transition

**Step 3: Deploy and Test**
1. Deploy all edge functions (automatic)
2. Test SMS sending with `send-2fa-sms` function
3. Test SMS sending with `send-twilio-sms` function
4. Verify success in logs

**Step 4: Revoke Old Token**
1. Return to Twilio Console
2. Revoke the old Auth Token
3. Confirm no errors in production logs for 24 hours

**Rollback Plan:** If errors occur, immediately restore old token in Supabase secrets and redeploy.

---

## 2. AGORA VIDEO CREDENTIALS

### Secrets to Rotate
- `AGORA_APP_ID` (public identifier, no rotation needed)
- `AGORA_APP_CERTIFICATE` (high risk)

### Rotation Procedure

**Step 1: Generate New Certificate**
1. Log in to [Agora Console](https://console.agora.io)
2. Navigate to your project
3. Click "Enable" under Primary Certificate or regenerate
4. Copy the new certificate

**Step 2: Update Supabase Secrets**
1. Update `AGORA_APP_CERTIFICATE` in Backend → Secrets
2. Keep old certificate active during transition (Agora supports dual certificates)

**Step 3: Deploy and Test**
1. Deploy all edge functions
2. Start a test video session with `start-video-session`
3. Join the session with `join-video-session`
4. Verify tokens are generated correctly
5. Verify video connection works

**Step 4: Disable Old Certificate**
1. Return to Agora Console
2. Disable the old certificate
3. Monitor logs for 24 hours

**Rollback Plan:** Re-enable old certificate in Agora Console immediately if errors occur.

---

## 3. AUTHORIZE.NET CREDENTIALS

### Secrets to Rotate
- `AUTHORIZENET_API_LOGIN_ID` (identifier)
- `AUTHORIZENET_TRANSACTION_KEY` (high risk)

### Rotation Procedure

**Step 1: Generate New Transaction Key**
1. Log in to [Authorize.Net Merchant Interface](https://account.authorize.net)
2. Navigate to Account → Settings → Security Settings → API Credentials & Keys
3. Click "New Transaction Key"
4. Confirm and copy the new key immediately

**Step 2: Update Supabase Secrets**
1. Update `AUTHORIZENET_TRANSACTION_KEY` in Backend → Secrets
2. Keep old key active during transition

**Step 3: Deploy and Test**
1. Deploy all edge functions
2. Test a payment with `authorizenet-charge-payment`
3. Test a refund with `authorizenet-refund-transaction`
4. Verify transactions in Authorize.Net dashboard

**Step 4: Deactivate Old Key**
1. After 24 hours of successful transactions
2. No explicit deactivation needed (new key replaces old)

**Rollback Plan:** Restore old key in Supabase secrets if payment failures occur.

---

## 4. POSTMARK API KEY

### Secrets to Rotate
- `POSTMARK_API_KEY` (high risk)

### Rotation Procedure

**Step 1: Generate New API Key**
1. Log in to [Postmark Account](https://account.postmarkapp.com)
2. Navigate to Servers → [Your Server] → API Tokens
3. Click "Create Token"
4. Copy the new token

**Step 2: Update Supabase Secrets**
1. Update `POSTMARK_API_KEY` in Backend → Secrets
2. Deploy all edge functions

**Step 3: Test Email Sending**
1. Test with `send-verification-email`
2. Test with `send-password-reset-email`
3. Test with `send-welcome-email`
4. Test with `unified-email-sender`
5. Verify emails arrive and are formatted correctly

**Step 4: Delete Old Token**
1. Return to Postmark → API Tokens
2. Delete the old token
3. Monitor email delivery for 24 hours

**Rollback Plan:** Recreate old token or restore from backup if emails fail to send.

---

## 5. GOHIGHLEVEL WEBHOOK SECRET

### Secrets to Rotate
- `GHL_WEBHOOK_SECRET` (high risk)

### Rotation Procedure

**Step 1: Generate New Secret**
1. Log in to GoHighLevel
2. Navigate to Settings → Integrations → Webhooks
3. Regenerate webhook secret
4. Copy the new secret

**Step 2: Update Supabase Secrets**
1. Update `GHL_WEBHOOK_SECRET` in Backend → Secrets
2. Deploy all edge functions

**Step 3: Test Webhook Reception**
1. Trigger a test webhook from GoHighLevel
2. Verify `send-2fa-sms` receives and validates webhook
3. Check logs for successful signature validation

**Step 4: Monitor**
1. Monitor for 24 hours
2. Ensure no webhook failures

**Rollback Plan:** Restore old secret in both GoHighLevel and Supabase if webhook validation fails.

---

## 6. SUPABASE SERVICE ROLE KEY

### Secrets to Rotate
- `SUPABASE_SERVICE_ROLE_KEY` (critical risk)

### Rotation Procedure

**⚠️ WARNING:** This is the most sensitive secret. Rotation causes brief downtime.

**Step 1: Schedule Maintenance Window**
1. Schedule during low-traffic period (e.g., 2 AM - 3 AM)
2. Notify users of potential brief downtime
3. Prepare rollback plan

**Step 2: Regenerate Key**
1. Contact Supabase Support or use dashboard
2. Navigate to Project Settings → API
3. Regenerate Service Role Key
4. Copy the new key immediately

**Step 3: Update All Edge Functions**
1. Update `SUPABASE_SERVICE_ROLE_KEY` in Backend → Secrets
2. Deploy all 145+ edge functions (automatic)
3. Monitor deployment for errors

**Step 4: Test Critical Functions**
1. Test admin functions: `assign-user-role`, `factory-reset`
2. Test payment functions: `authorizenet-charge-payment`
3. Test order functions: `place-order`, `route-order-to-pharmacy`
4. Test video functions: `start-video-session`

**Step 5: Monitor Production**
1. Monitor logs for 24 hours
2. Check error rates in dashboard
3. Verify no unexpected 401/403 errors

**Rollback Plan:** If critical errors occur, immediately restore old key and redeploy. Contact Supabase support if needed.

---

## 7. ADMIN IP ALLOWLIST

### Secrets to Review
- `ADMIN_IP_1` through `ADMIN_IP_5`

### Review Procedure (Quarterly)

**Step 1: Audit Current IPs**
1. List all IPs currently in allowlist
2. Verify each IP is still authorized
3. Check for team member departures

**Step 2: Update Allowlist**
1. Remove IPs for departed team members
2. Add IPs for new admin team members
3. Update in Backend → Secrets

**Step 3: Test Access**
1. Test from authorized IP: should succeed
2. Test from unauthorized IP: should be blocked with 403
3. Verify security events are logged

**Step 4: Document Changes**
1. Log all IP changes in security audit
2. Note reason for each change
3. Update this document if needed

---

## 8. CRON SECRETS

### Secrets to Rotate
- `CRON_SECRET` (used by penetration testing functions)

### Rotation Procedure (Annually)

**Step 1: Generate New Secret**
1. Generate cryptographically secure random string:
   ```bash
   openssl rand -hex 32
   ```
2. Copy the new secret

**Step 2: Update Supabase Secrets**
1. Update `CRON_SECRET` in Backend → Secrets
2. Deploy all edge functions

**Step 3: Update CRON Jobs**
1. Update any scheduled CRON jobs (if configured)
2. Update documentation with new secret

**Step 4: Test Penetration Functions**
1. Test `penetration-test-rls` with new secret
2. Test `penetration-test-storage` with new secret
3. Verify all tests run successfully

---

## EMERGENCY ROTATION

### When to Perform Emergency Rotation

- Secret accidentally exposed in logs, code, or communication
- Team member with access departs under unfavorable circumstances
- Security incident or breach detected
- Unauthorized access attempts detected

### Emergency Procedure

1. **Immediate Action:** Rotate the compromised secret within 1 hour
2. **Notification:** Alert security team and management
3. **Investigation:** Determine scope of exposure
4. **Monitoring:** Increase monitoring for 7 days after rotation
5. **Documentation:** Document incident and response

---

## ROTATION VERIFICATION CHECKLIST

After each rotation, verify:

- [ ] New secret is active in Supabase
- [ ] All edge functions deployed successfully
- [ ] Test functions for secret work correctly
- [ ] No errors in production logs for 24 hours
- [ ] Old secret has been deactivated/revoked
- [ ] Rotation documented in security audit history
- [ ] Team notified of rotation completion

---

## DOCUMENTATION

### Logging Rotations

Log all secret rotations in `security_audit_history` table:

```sql
INSERT INTO security_audit_history (report_data, audited_by, notes)
VALUES (
  jsonb_build_object(
    'action', 'secret_rotation',
    'secret_name', 'TWILIO_AUTH_TOKEN',
    'rotation_date', NOW(),
    'reason', 'Quarterly scheduled rotation'
  ),
  'admin@vitaluxe.com',
  'Rotated Twilio auth token successfully. All tests passed.'
);
```

### Monthly Review

- Review rotation schedule
- Check for upcoming rotations
- Update this document if procedures change

---

## CONTACTS

**Security Team Lead:** [Contact Email]  
**Supabase Support:** support@supabase.io  
**Twilio Support:** support@twilio.com  
**Agora Support:** support@agora.io  
**Authorize.Net Support:** [Merchant Support]  
**Postmark Support:** support@postmarkapp.com

---

**Document Status:** ✅ PRODUCTION READY  
**Next Review Date:** 2026-02-19
