# Security Incident Response Procedures

This document outlines procedures for responding to security incidents in the VitaLuxe application.

## 1. Account Lockout Incidents

**Trigger:** User reports they cannot login (account is locked)

**Response Procedure:**

1. Login to admin account
2. Navigate to **Security → Account Security** tab
3. Find the user in the `account_lockouts` table
4. Review the following details:
   - `lockout_reason`: Why the account was locked
   - `locked_until`: When the lockout expires
   - `ip_address`: Where the failed attempts originated
   - `attempt_count`: Number of failed login attempts (if from brute force detection)

5. **Decision Making:**
   - **If legitimate brute force attack:** Keep account locked until `locked_until` expires
   - **If user forgot password:** Click "Unlock" button → User can now login
   - **If suspicious activity:** Keep locked and contact user via email to verify identity

6. **Document the Decision:**
   - Add notes in the `notes` field explaining why you unlocked or kept locked
   - Example: "Unlocked after verifying user identity via phone. User confirmed forgot password."

7. **Follow-up:**
   - If unlocked, send user a password reset link
   - Monitor for additional failed login attempts
   - Consider enabling 2FA for this user

---

## 2. Brute Force Attack Detection

**Trigger:** Alert with severity: critical, event_type: brute_force

**Response Procedure:**

1. Navigate to **Security → Security Events** tab
2. Filter by `event_type = brute_force`
3. Review attack details:
   - `ip_address`: Source of attack
   - `email`: Targeted account
   - `attempt_count`: Number of failed attempts
   - `timestamp`: When attack occurred

4. **Analyze the Attack:**
   - Check if multiple accounts are targeted from the same IP
   - Review `failed_login_attempts` table for patterns
   - Determine attack timeline (how long did it last?)

5. **Immediate Actions:**
   - **If single user targeted:** Account is automatically locked for 30 minutes
   - **If multiple accounts targeted:** Consider IP blocking at infrastructure level
   - **If ongoing:** Monitor real-time for additional attempts

6. **Long-term Actions:**
   - Review rate limiting rules (consider tightening for `/auth` endpoints)
   - Consider implementing CAPTCHA after 3 failed attempts
   - Notify affected users via email about suspicious activity

7. **Documentation:**
   - Record incident in `security_events` with type: `incident_resolved`
   - Include details about actions taken and outcome

---

## 3. PHI Access Anomalies

**Trigger:** Unusual spike in PHI access (prescription_accessed, patient records)

**Response Procedure:**

1. Navigate to **Security → PHI Access** tab
2. Review `audit_logs` for suspicious patterns:
   - Same user accessing many patient records in short time
   - Access to patients outside user's practice
   - Access during unusual hours (3 AM - 5 AM)

3. **Identify the User:**
   - Note the `user_id` and `user_email`
   - Check their role and practice association
   - Review their typical access patterns

4. **Verify Legitimacy:**
   - Contact the user directly to confirm the activity
   - Ask: "Did you access [X number] of patient records on [date] at [time]?"
   - If user confirms → Document as legitimate
   - If user denies → Proceed to step 5

5. **If Unauthorized Access:**
   - **Immediately lock the account:** Navigate to Account Security → Create manual lockout
   - **Notify compliance team:** Send email with incident details
   - **Preserve evidence:** Export all `audit_logs` related to this user
   - **Review accessed records:** Identify which patients' PHI was accessed

6. **Legal/Compliance Notification:**
   - If HIPAA breach is suspected, notify legal team within 24 hours
   - Document all affected patient records
   - Prepare breach notification if required by HIPAA

7. **Follow-up:**
   - Reset user's password
   - Require additional verification before reinstating access
   - Consider implementing stricter access controls for this user

---

## 4. Encryption Key Compromise

**Trigger:** Unauthorized access to `encryption_keys` table detected

**⚠️ CRITICAL - HIGHEST PRIORITY INCIDENT ⚠️**

**Response Procedure:**

1. **IMMEDIATE ACTIONS (Within 1 hour):**
   - Lock all accounts immediately (except admin)
   - Take the application offline if possible
   - Notify executive team and legal counsel

2. **Assess the Breach:**
   - Review `audit_logs` for all queries to `encryption_keys` table
   - Identify which keys were accessed
   - Determine the scope: Were keys exported? Downloaded? Viewed?

3. **Key Rotation (Within 6 hours):**
   - Generate new encryption keys immediately
   - Re-encrypt ALL PHI data with new keys
   - Verify old keys are deactivated

4. **Audit All Encrypted Data:**
   - Review all `patients` records (allergies, notes)
   - Review all `order_lines` records (prescriptions, custom_dosage, custom_sig)
   - Check `practice_payment_methods` (Plaid tokens)
   - Identify any data that may have been decrypted during breach

5. **Legal/Compliance:**
   - File security incident report with compliance team
   - Notify affected users within 60 days (HIPAA requirement)
   - Document all actions taken

6. **Post-Incident:**
   - Review RLS policies on `encryption_keys` table
   - Implement additional access controls
   - Consider hardware security module (HSM) for key storage
   - Conduct security audit of entire application

---

## 5. Concurrent Session Anomalies

**Trigger:** Alert for concurrent sessions from different IPs

**Response Procedure:**

1. Navigate to **Security → Active Sessions** (if implemented)
2. Review `active_sessions` table:
   - `user_id`: Affected user
   - `ip_addresses`: Multiple IPs detected
   - `last_activity`: Recent activity from each session

3. **Analyze the Sessions:**
   - Check geographic locations of IPs (if geolocation is enabled)
   - Example: Session from California + Session from Russia = High risk
   - Example: Session from home + Session from office = Likely legitimate

4. **Contact the User:**
   - Send email: "We detected login from [Location 1] and [Location 2] simultaneously"
   - Ask user to confirm: "Is this you?"
   - If user confirms → Document as legitimate
   - If user denies → Proceed to step 5

5. **If Unauthorized:**
   - Terminate all active sessions immediately
   - Force password reset
   - Lock account until user verifies identity
   - Review recent activity from suspicious session

6. **Follow-up:**
   - Enable 2FA for this user
   - Monitor for additional unauthorized access attempts

---

## 6. Suspicious Order Activity

**Trigger:** Unusual order patterns (high volume, unusual products, etc.)

**Response Procedure:**

1. Navigate to **Orders** page
2. Filter orders by suspicious patterns:
   - Same patient, multiple orders in short time
   - High quantities of controlled substances
   - Orders to unusual states

3. **Review Order Details:**
   - Check prescriber information
   - Verify prescription legitimacy
   - Review practice history

4. **Contact the Practice:**
   - Call or email practice to verify order
   - Ask to confirm prescription was written
   - If confirmed → Process normally
   - If denied → Proceed to step 5

5. **If Fraudulent:**
   - Cancel the order immediately
   - Flag the practice account for review
   - Notify pharmacy (if already routed)
   - Document incident in security_events

6. **Legal Notification:**
   - If controlled substance fraud suspected, notify DEA
   - Preserve all evidence (prescriptions, order records)
   - Coordinate with legal team

---

## Weekly Security Review

**Schedule:** Every Monday at 9:00 AM

**Checklist:**

- [ ] **Review Security Events (past 7 days)**
  - Navigate to Security → Security Events
  - Look for patterns: Multiple brute force attempts, unusual PHI access, etc.
  - Flag any events requiring follow-up

- [ ] **Check Account Lockouts**
  - Review all lockouts from past week
  - Verify appropriate actions were taken
  - Look for patterns (same IP targeting multiple accounts)

- [ ] **Verify Encryption Key Rotation**
  - Check `encryption_keys` table → `rotated_at` column
  - If last rotation > 90 days → Schedule rotation
  - Verify all encrypted data is using active keys

- [ ] **Review Failed Login Attempts**
  - Check `failed_login_attempts` table for trends
  - Identify IPs with high failure rates
  - Consider blocking repeat offenders

- [ ] **Check Impersonation Logs**
  - Review all impersonation sessions from past week
  - Verify only authorized admins impersonated
  - Look for unusual patterns (impersonating same user repeatedly)

- [ ] **PHI Access Patterns**
  - Review `audit_logs` for PHI access (prescription_accessed, patient records)
  - Identify users with unusually high access counts
  - Investigate any anomalies

- [ ] **System Health**
  - Review error logs for security-related errors
  - Check for failed RLS policy enforcements
  - Verify all security features are operational

---

## Emergency Contacts

**Security Incidents:**
- **Admin Contact:** admin@vitaluxeservice.com
- **Legal/Compliance:** [Add contact when available]
- **Technical Support:** [Add contact when available]

**Data Breach:**
- **HIPAA Compliance Officer:** [Add contact when available]
- **Legal Counsel:** [Add contact when available]
- **Executive Team:** [Add contact when available]

**Severity Levels:**

- **Critical (P0):** Encryption key compromise, active PHI breach, system-wide security failure
  - Response time: Immediate (within 1 hour)
  - Notification: All stakeholders + legal + executives

- **High (P1):** Brute force attack, suspicious PHI access, account compromise
  - Response time: Within 4 hours
  - Notification: Security team + compliance officer

- **Medium (P2):** Account lockouts, concurrent session anomalies, unusual order patterns
  - Response time: Within 24 hours
  - Notification: Security team

- **Low (P3):** General security monitoring, routine audits
  - Response time: Next business day
  - Notification: Security team (optional)

---

## Post-Incident Report Template

After resolving any security incident, complete this report:

**Incident Summary:**
- **Date/Time:** [When incident occurred]
- **Severity:** [Critical / High / Medium / Low]
- **Type:** [Brute force / PHI breach / Account compromise / etc.]

**Detection:**
- **How was it detected?** [Alert system / User report / Routine audit]
- **Who detected it?** [Admin name]

**Impact:**
- **Affected Users:** [Number and roles]
- **Data Affected:** [PHI / PII / Financial / None]
- **Duration:** [How long was the incident active?]

**Response Actions:**
- **Immediate Actions:** [What was done in first hour?]
- **Investigation:** [What was discovered?]
- **Resolution:** [How was it resolved?]

**Root Cause:**
- **Why did this happen?** [Technical failure / Human error / Malicious actor]
- **What allowed it?** [Missing security control / Weak password / etc.]

**Prevention:**
- **What will prevent this in future?** [New policies / Technical changes / Training]
- **Action Items:** [List specific tasks with owners and deadlines]

**Lessons Learned:**
- **What went well?** [Fast detection / Good communication / etc.]
- **What needs improvement?** [Response time / Documentation / etc.]

---

## Version History

- **v1.0** - 2025-01-14 - Initial security incident response procedures created
- **v1.1** - [Date] - [Changes made]

---

## Document Maintenance

- **Review Frequency:** Quarterly
- **Next Review Date:** [90 days from last update]
- **Document Owner:** Security Administrator
- **Approval Required:** Legal + Compliance + Executive Team
