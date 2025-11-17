# Breach Response Playbook

**Version:** 1.0  
**Effective Date:** 2025-11-17  
**Owner:** Security & Compliance Team  
**Purpose:** Step-by-step incident response procedures for security breaches

---

## Table of Contents

1. [Phase 1: Detection & Initial Response (0-1 Hour)](#phase-1-detection--initial-response-0-1-hour)
2. [Phase 2: Containment & Evidence Preservation (1-4 Hours)](#phase-2-containment--evidence-preservation-1-4-hours)
3. [Phase 3: Investigation & Risk Assessment (4-24 Hours)](#phase-3-investigation--risk-assessment-4-24-hours)
4. [Phase 4: Notification Preparation (24-48 Hours)](#phase-4-notification-preparation-24-48-hours)
5. [Phase 5: Notification Execution (Day 2-60)](#phase-5-notification-execution-day-2-60)
6. [Phase 6: Post-Incident Review (Day 30-60)](#phase-6-post-incident-review-day-30-60)

---

## Phase 1: Detection & Initial Response (0-1 Hour)

### 🚨 CRITICAL: First 60 Minutes Determine Success of Response

### Step 1.1: Detect & Verify (Minutes 0-15)

**Automated Detection:**
- Alert received from monitoring system (see `alert_policies.json`)
- Audit log anomaly detected
- Third-party notification (vendor, patient, law enforcement)

**Manual Detection:**
- Employee report
- Patient complaint
- Security assessment finding

**Actions:**
```bash
# ✅ DO THIS IMMEDIATELY
1. Acknowledge alert in monitoring system
2. Assign incident number: INC-[YYYYMMDD]-[###]
3. Create incident Slack channel: #incident-[number]
4. Page on-call security engineer
```

**Initial Verification Questions:**
- [ ] Is this a confirmed breach or false positive?
- [ ] Is the breach still active or contained?
- [ ] How many individuals potentially affected?
- [ ] What type of PHI is involved?

### Step 1.2: Assemble Response Team (Minutes 15-30)

**Required Team Members:**

| Role | Contact | Responsibilities |
|------|---------|------------------|
| **Incident Commander** | Security Lead | Overall response coordination |
| **Technical Lead** | CTO or Senior Dev | System containment, forensics |
| **Compliance Officer** | Compliance Team | Risk assessment, notification requirements |
| **Legal Counsel** | Law Firm | Legal obligations, attorney-client privilege |
| **Communications Lead** | PR/Marketing | Public relations, messaging |

**Communication Protocol:**
```
Subject: [CONFIDENTIAL] Security Incident INC-[number] - [SEVERITY]

Incident Commander: [Name]
Severity: [Level 1-4]
Affected Systems: [List]
Individuals Affected: [Estimated count]
PHI Involved: [Types]

Join incident response:
- Slack: #incident-[number]
- Zoom: [meeting link]
- Doc: [Google Doc for real-time notes]

Next Update: [Time]
```

### Step 1.3: Initial Containment (Minutes 30-60)

**Immediate Actions (NO PERMISSION NEEDED):**

1. **Isolate Affected Systems**
   ```bash
   # If database breach suspected
   pg_terminate_backend(<pid>)  # Kill suspicious connections
   
   # If compromised user account
   UPDATE auth.users SET banned_until = 'infinity' WHERE id = '<user_id>';
   
   # If API key compromised
   # Revoke key in Supabase dashboard immediately
   ```

2. **Revoke Credentials**
   - Disable compromised user accounts
   - Rotate API keys if exposed
   - Reset passwords for affected accounts
   - Revoke session tokens

3. **Block Malicious IPs**
   ```sql
   -- Add to IP ban list
   INSERT INTO admin_ip_banlist (ip_address, banned_by, banned_reason, expires_at)
   VALUES ('<IP>', 'incident-commander', 'INC-[number] breach response', now() + interval '24 hours');
   ```

4. **Enable Enhanced Logging**
   ```sql
   -- Temporarily increase audit logging
   UPDATE system_settings 
   SET value = 'debug'
   WHERE key = 'audit_log_level';
   ```

### Step 1.4: Preliminary Assessment (Minutes 45-60)

**Answer These Questions:**

1. **Scope of Breach:**
   - How many patients affected? (Estimate)
   - What PHI was exposed? (Names, SSNs, diagnoses, etc.)
   - What systems were accessed? (Database, file storage, email, etc.)

2. **Breach Classification (Preliminary):**
   - Use `breach_severity_matrix.md` for initial classification
   - **Level 4:** ≥500 affected OR sensitive PHI OR malicious intent
   - **Level 3:** 100-499 affected OR unencrypted device loss
   - **Level 2:** 10-99 affected OR misconfiguration
   - **Level 1:** <10 affected AND low harm probability

3. **Notification Timeline:**
   - **Level 4:** 24-hour notification clock starts NOW
   - **Level 3:** 7-day notification clock starts NOW
   - **Level 2:** 30-day notification clock starts NOW
   - **Level 1:** 60-day clock OR no notification (pending risk assessment)

**Decision Point:** STOP or CONTINUE?
- **STOP:** If false positive → Document and close incident
- **CONTINUE:** If confirmed breach → Proceed to Phase 2

---

## Phase 2: Containment & Evidence Preservation (1-4 Hours)

### Step 2.1: Complete Containment (Hour 1-2)

**System-Specific Containment:**

**Database Breach:**
```sql
-- 1. Identify affected tables
SELECT table_name, n_live_tup 
FROM pg_stat_user_tables 
WHERE schemaname = 'public' 
ORDER BY n_live_tup DESC;

-- 2. Review recent queries on affected tables
SELECT usename, query, query_start
FROM pg_stat_activity
WHERE query LIKE '%<affected_table>%'
  AND query_start > now() - interval '24 hours';

-- 3. Enable row-level auditing temporarily
ALTER TABLE <affected_table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emergency_audit" ON <affected_table> FOR ALL 
USING (log_audit_event('emergency_access', '<affected_table>', id, '{}'::jsonb) AND false);
```

**Storage Breach (S3/Supabase Storage):**
```bash
# 1. List recently accessed files
aws s3api list-objects-v2 \
  --bucket vitaluxe-documents \
  --prefix "prescriptions/" \
  --query "Contents[?LastModified>`2025-01-15`]"

# 2. Revoke public access (if misconfigured)
aws s3api put-public-access-block \
  --bucket vitaluxe-documents \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# 3. Enable versioning (if not already)
aws s3api put-bucket-versioning \
  --bucket vitaluxe-documents \
  --versioning-configuration Status=Enabled
```

**Email Breach:**
```
# 1. Recall email (if Office 365/Gmail allows)
# 2. Contact recipient and request deletion confirmation
# 3. Document recipient response
# 4. If sensitive PHI, offer credit monitoring
```

### Step 2.2: Evidence Preservation (Hour 2-3)

**CRITICAL: Preserve evidence BEFORE investigation destroys logs**

**Database Snapshot:**
```bash
# Full database dump with timestamp
pg_dump -h <host> -U <user> -Fc \
  -f /secure/evidence/breach_db_snapshot_INC-<number>_$(date +%Y%m%d_%H%M%S).dump \
  <database_name>

# Calculate hash for chain of custody
sha256sum breach_db_snapshot_*.dump > checksums.txt
```

**Audit Logs Export:**
```sql
-- Export all audit logs for past 90 days
COPY (
  SELECT 
    id, user_id, user_email, user_role, action_type, entity_type, 
    entity_id, details, ip_address, user_agent, created_at
  FROM audit_logs 
  WHERE created_at > now() - interval '90 days'
  ORDER BY created_at DESC
) TO '/secure/evidence/audit_logs_INC-<number>_<timestamp>.csv' 
CSV HEADER;
```

**Edge Function Logs:**
```bash
# Export logs for affected functions
supabase functions logs <function-name> --tail 10000 \
  > /secure/evidence/edge_logs_<function>_INC-<number>.txt

# Export for all critical functions
for func in place-order manage-cart manage-documents; do
  supabase functions logs $func --tail 10000 > edge_logs_${func}_INC.txt
done
```

**Network Logs:**
- Firewall logs (if on-prem or hybrid)
- Load balancer access logs
- Supabase connection logs (via dashboard)
- CDN logs (if applicable)

**Chain of Custody Log:**
```
Incident Number: INC-<number>
Evidence Item: <filename>
Collected By: <name>
Date/Time: <timestamp>
Hash: <sha256>
Storage Location: <s3://bucket/path>
Access Restrictions: Incident response team + legal only
```

### Step 2.3: Determine Root Cause (Hour 3-4)

**Common Root Causes:**

1. **Application Vulnerability**
   - SQL injection
   - XSS (Cross-Site Scripting)
   - CSRF (Cross-Site Request Forgery)
   - Authentication bypass
   - **Action:** Patch code, deploy hotfix

2. **Configuration Error**
   - Misconfigured RLS policy
   - S3 bucket made public
   - Database firewall rule too permissive
   - **Action:** Correct configuration, audit all settings

3. **Credential Compromise**
   - Phished password
   - Leaked API key
   - Shared credentials
   - **Action:** Rotate all credentials, enforce MFA

4. **Insider Threat**
   - Malicious employee
   - Unauthorized access by staff
   - **Action:** Revoke access, HR investigation, law enforcement

5. **Third-Party Breach**
   - Vendor security incident
   - Supply chain attack
   - **Action:** Contact vendor, review BAA, terminate if necessary

**Root Cause Analysis Template:**
```markdown
## Root Cause Analysis - INC-<number>

### Incident Summary
- **Date of Breach:** [YYYY-MM-DD]
- **Date of Discovery:** [YYYY-MM-DD]
- **Affected Systems:** [List]
- **Individuals Affected:** [Count]

### Timeline of Events
1. [Time] - [Event description]
2. [Time] - [Event description]
...

### Root Cause
[Technical description of vulnerability or error]

### Contributing Factors
- Factor 1
- Factor 2

### Why It Wasn't Detected Earlier
[Explanation of detection gap]

### Immediate Fix Applied
[Hotfix/configuration change description]

### Long-Term Preventative Measures
1. [Measure 1]
2. [Measure 2]
```

---

## Phase 3: Investigation & Risk Assessment (4-24 Hours)

### Step 3.1: Detailed Forensic Investigation (Hours 4-12)

**Query Audit Logs for Suspicious Activity:**

```sql
-- 1. Find all access by suspicious user
SELECT * FROM audit_logs
WHERE user_id = '<suspicious_user_id>'
  AND created_at BETWEEN '<breach_start>' AND '<breach_end>'
ORDER BY created_at;

-- 2. Find all PHI access events during breach window
SELECT 
  action_type, 
  entity_type,
  entity_id,
  user_email,
  COUNT(*) as access_count
FROM audit_logs
WHERE action_type IN ('patient_phi_accessed', 'prescription_accessed', 'order_accessed')
  AND created_at BETWEEN '<breach_start>' AND '<breach_end>'
GROUP BY action_type, entity_type, entity_id, user_email
ORDER BY access_count DESC;

-- 3. Find anomalous access patterns
SELECT 
  user_id,
  user_email,
  COUNT(DISTINCT entity_id) as unique_records_accessed,
  MIN(created_at) as first_access,
  MAX(created_at) as last_access
FROM audit_logs
WHERE action_type = 'patient_phi_accessed'
  AND created_at BETWEEN '<breach_start>' AND '<breach_end>'
GROUP BY user_id, user_email
HAVING COUNT(DISTINCT entity_id) > 50  -- Threshold for bulk access
ORDER BY unique_records_accessed DESC;
```

**Identify Affected Individuals:**

```sql
-- Export list of affected patients
COPY (
  SELECT DISTINCT
    pa.id as patient_id,
    pa.first_name,
    pa.last_name,
    pa.email,
    pa.phone,
    pa.address,
    al.action_type,
    al.created_at as accessed_at,
    al.user_email as accessed_by
  FROM audit_logs al
  JOIN patient_accounts pa ON pa.id = al.entity_id::uuid
  WHERE al.entity_type = 'patients'
    AND al.created_at BETWEEN '<breach_start>' AND '<breach_end>'
  ORDER BY pa.last_name, pa.first_name
) TO '/secure/evidence/affected_individuals_INC-<number>.csv' 
CSV HEADER;
```

### Step 3.2: HIPAA 4-Factor Risk Assessment (Hours 12-18)

**Complete Risk Assessment Form:**

```markdown
## HIPAA Risk Assessment - INC-<number>

### Factor 1: Nature and Extent of PHI Involved

**PHI Categories Exposed:** (Check all that apply)
- [ ] Names
- [ ] Social Security Numbers
- [ ] Date of Birth
- [ ] Addresses
- [ ] Phone Numbers
- [ ] Email Addresses
- [ ] Medical Record Numbers
- [ ] Diagnoses
- [ ] Treatment Plans
- [ ] Prescriptions
- [ ] Lab Results
- [ ] Imaging
- [ ] Mental Health Records
- [ ] HIV Status
- [ ] Substance Abuse Records
- [ ] Genetic Information
- [ ] Payment/Financial Information

**Assessment:** [HIGH / MEDIUM / LOW]

**Rationale:** [Explain based on sensitivity]

---

### Factor 2: Unauthorized Person Who Accessed PHI

**Who Accessed:**
- [ ] External malicious actor (hacker, cybercriminal)
- [ ] Unknown external party
- [ ] Healthcare provider (wrong practice)
- [ ] Employee without authorization
- [ ] Business Associate
- [ ] Vendor/contractor
- [ ] Patient family member
- [ ] Other: __________

**Intent:**
- [ ] Malicious (identity theft, fraud, harassment)
- [ ] Accidental (human error, misconfiguration)
- [ ] Unknown

**Assessment:** [HIGH / MEDIUM / LOW]

**Rationale:** [Explain based on actor and intent]

---

### Factor 3: Whether PHI Was Actually Acquired or Viewed

**Evidence of Acquisition:**
- [ ] Data downloaded/exported
- [ ] Screenshots taken
- [ ] Printed copies
- [ ] Data transferred to external system
- [ ] Audit logs confirm viewing
- [ ] Email opened (read receipt)
- [ ] File accessed (access logs)

**Evidence of NO Acquisition:**
- [ ] Access granted but no viewing confirmed
- [ ] Email sent but bounce-back received
- [ ] Document opened for < 5 seconds
- [ ] User immediately reported and closed

**Assessment:** [HIGH / MEDIUM / LOW]

**Rationale:** [Explain based on evidence]

---

### Factor 4: Extent to Which Risk Has Been Mitigated

**Mitigation Actions Taken:**
- [ ] Data retrieved/deleted from unauthorized location
- [ ] Recipient signed confidentiality agreement
- [ ] Encryption applied post-breach (device recovered)
- [ ] Monitoring services offered (credit, identity)
- [ ] Technical controls implemented to prevent recurrence
- [ ] Legal hold issued
- [ ] Law enforcement involved

**Mitigation Effectiveness:**
- [ ] HIGH - Risk fully mitigated (data confirmed destroyed)
- [ ] MEDIUM - Risk partially mitigated (some uncertainty remains)
- [ ] LOW - Risk not mitigated (data in the wild)

**Assessment:** [HIGH / MEDIUM / LOW MITIGATION]

**Rationale:** [Explain mitigation effectiveness]

---

### OVERALL DETERMINATION

**Risk of Harm to Individuals:** [HIGH / MEDIUM / LOW]

**Notification Required:** [YES / NO]

**Reasoning:**
[Synthesize all 4 factors to explain decision]

**If "NO NOTIFICATION":**
- [ ] All 4 factors assessed as LOW or LOW-MEDIUM
- [ ] Risk of harm assessed as LOW PROBABILITY
- [ ] Legal counsel reviewed and concurs
- [ ] Documentation retained for 6 years

**If "YES NOTIFICATION":**
- [ ] At least one factor assessed as HIGH
- [ ] Risk of harm assessed as MEDIUM or HIGH
- [ ] Proceed to Phase 4 (Notification Preparation)

---

**Assessor:** [Name, Title]  
**Date:** [YYYY-MM-DD]  
**Reviewed By:** [Legal Counsel Name]  
**Approved By:** [Compliance Officer Name]
```

### Step 3.3: Confirm Severity Classification (Hours 18-24)

**Re-evaluate Initial Classification:**
- Was preliminary classification (Level 1-4) accurate?
- Has investigation revealed more/fewer affected individuals?
- Has risk assessment changed notification requirements?

**Update Incident Record:**
```
Incident: INC-<number>
Initial Classification: [Level]
Final Classification: [Level]
Rationale for Change: [Explanation if different]
```

---

## Phase 4: Notification Preparation (24-48 Hours)

### Step 4.1: Determine Who Must Be Notified (Hour 24-28)

**Notification Matrix:**

| Severity | Individuals | HHS OCR | Media | State AG | Law Enforcement |
|----------|-------------|---------|-------|----------|-----------------|
| Level 4  | ✅ (24hr)   | ✅ If ≥500 | ✅ If ≥500 | ✅ | ✅ Optional |
| Level 3  | ✅ (7 day)  | ✅ If ≥500 | ❌ | ✅ If req'd | ❌ |
| Level 2  | ✅ (30 day) | ✅ Annual | ❌ | ✅ If req'd | ❌ |
| Level 1  | ⚠️ Optional | ✅ Annual | ❌ | ❌ | ❌ |

**Checklist:**
- [ ] Count total affected individuals (exact or good-faith estimate)
- [ ] Identify states where affected individuals reside
- [ ] Review state-specific breach laws for each state
- [ ] Confirm HHS notification threshold (≥500 or <500)
- [ ] Determine if media notification required (≥500 in single state)
- [ ] Check if Law Enforcement requested notification delay (rare)

### Step 4.2: Draft Individual Notifications (Hour 28-36)

**Use Template:** `ops/compliance/templates/breach_notification_letter.docx`

**Required Elements (HIPAA § 164.404):**
1. ✅ Brief description of what happened
2. ✅ Date of breach (or estimated timeframe)
3. ✅ Date breach was discovered
4. ✅ Types of PHI involved
5. ✅ Steps individuals should take to protect themselves
6. ✅ What VitaLuxePro is doing to investigate/mitigate
7. ✅ Contact information for questions

**Tone Guidelines:**
- Clear and professional
- Factual, not defensive
- Empathetic without minimizing
- Action-oriented (tell individuals what to do)

**Review Checklist:**
- [ ] All HIPAA-required elements included
- [ ] No jargon or technical terms
- [ ] No speculation on cause (if investigation ongoing)
- [ ] Contact information accurate (hotline, email, website)
- [ ] Translated versions prepared (if applicable)
- [ ] Legal counsel reviewed
- [ ] Compliance officer approved

### Step 4.3: Prepare HHS Notification (Hour 36-42)

**HHS OCR Breach Portal:** https://ocrportal.hhs.gov/ocr/breach/wizard_breach.jsf

**Pre-Populate Data:**
- Covered Entity name, address, contact
- Number of affected individuals (exact or estimate)
- Date of breach
- Date of discovery
- Brief description (500 characters max)
- Type of breach (hacking, theft, unauthorized access, improper disposal, loss, other)
- Location of breached information (paper, electronic, portable device, etc.)

**Draft Description (500 char limit):**
```
On [Date], VitaLuxePro discovered [brief event description]. 
The breach affected approximately [#] individuals and involved 
[PHI types]. The breach was caused by [brief root cause]. 
VitaLuxePro has [actions taken]. Affected individuals are being 
notified via [method] and offered [services if applicable].
```

### Step 4.4: Prepare Public Communications (Hour 42-48)

**Press Release (for Level 4 breaches or ≥500 affected):**

Use Template: `ops/compliance/templates/breach_press_release.docx`

**Elements:**
- Headline (factual, not sensational)
- Date and location
- What happened (brief summary)
- Number of individuals affected
- Types of PHI involved
- What VitaLuxePro is doing
- What individuals should do
- Contact information (dedicated hotline, email, website)
- Boilerplate about VitaLuxePro

**FAQ Document:**

Create FAQ page on website addressing:
1. What happened?
2. What information was involved?
3. How did this happen?
4. What is VitaLuxePro doing?
5. What should I do to protect myself?
6. Am I affected?
7. How will I be notified?
8. Who can I contact for more information?
9. Will VitaLuxePro offer credit monitoring?
10. What is VitaLuxePro doing to prevent this in the future?

**Dedicated Breach Response Page:**
- URL: www.vitaluxepro.com/breach-response
- Include incident number for reference
- Update regularly with new information
- Archive for 6 years minimum

---

## Phase 5: Notification Execution (Day 2-60)

### Step 5.1: Notify Affected Individuals (Per Timeline)

**Notification Methods (in order of preference):**

1. **First-Class Mail (Default):**
   ```bash
   # Export mailing labels
   COPY (
     SELECT 
       first_name || ' ' || last_name as name,
       address_street as address1,
       address_city || ', ' || address_state || ' ' || address_zip as address2
     FROM patient_accounts
     WHERE id IN (SELECT patient_id FROM affected_individuals)
   ) TO '/secure/notifications/mailing_labels_INC-<number>.csv' CSV HEADER;
   
   # Send to mailing service (Lob.com or equivalent)
   # Track delivery confirmation
   ```

2. **Email (if individual opted-in to electronic communications):**
   ```sql
   -- Identify patients who opted-in to email
   SELECT id, email FROM patient_accounts
   WHERE id IN (SELECT patient_id FROM affected_individuals)
     AND email_opt_in = true;
   
   -- Send via unified-email-sender function
   -- Track open rates and delivery status
   ```

3. **Substitute Notice (if contact info insufficient for ≥10 individuals):**
   - Post prominent notice on homepage for 90 days
   - Issue press release to major media outlets (if ≥500 in state)

**Tracking:**
```sql
-- Create notification tracking table
CREATE TABLE breach_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_number text NOT NULL,
  patient_id uuid NOT NULL,
  notification_method text NOT NULL, -- 'mail', 'email', 'substitute'
  sent_date date NOT NULL,
  delivered_date date,
  opened_date date, -- email only
  tracking_number text, -- mail only
  status text NOT NULL, -- 'sent', 'delivered', 'bounced', 'opened'
  created_at timestamptz DEFAULT now()
);
```

### Step 5.2: Notify HHS OCR (Within 60 Days)

**For Breaches Affecting ≥500 Individuals:**

1. Log into HHS OCR Breach Portal
2. Complete online form (pre-populated from Step 4.3)
3. Submit within 60 days of discovery
4. **CRITICAL:** Save confirmation receipt/screenshot
5. Document submission in incident file

**For Breaches Affecting <500 Individuals:**

1. Add to annual breach log
2. Submit annual report to HHS by March 1 of following year
3. Report includes all <500 breaches from previous calendar year

### Step 5.3: Notify Media (If Required, Within 60 Days)

**Requirement:** Breaches affecting ≥500 individuals in a single state/jurisdiction

**Process:**
1. Identify major media outlets in affected state(s)
2. Issue press release (prepared in Step 4.4)
3. Distribute via PR Newswire or equivalent service
4. Update website with press release
5. Document all media outreach

### Step 5.4: Notify State Attorneys General (If Required)

**Check State Requirements:**
- California: Yes (if ≥500 CA residents)
- New York: Yes (any breach)
- Texas: Yes (any breach)
- [Add other states as applicable]

**Process:**
1. Send notification letter to State AG office
2. Include same information as individual notification
3. Confirm delivery via certified mail
4. Document in incident file

### Step 5.5: Monitor and Document (Ongoing)

**Weekly Status Report:**
```markdown
## Breach Notification Status Report - INC-<number>
**Week of:** [Date]

### Notifications Sent
- Mail: [#] sent, [#] delivered, [#] bounced
- Email: [#] sent, [#] delivered, [#] opened, [#] bounced
- Substitute: [Active / Complete]

### Regulatory Notifications
- HHS OCR: [Pending / Submitted on [Date] / Confirmed]
- Media: [Not Required / Sent on [Date]]
- State AG: [Not Required / Sent to [States] on [Date]]

### Inquiries Received
- Phone: [#] calls handled
- Email: [#] emails responded to
- Common questions: [List top 3]

### Issues
- [Any delivery problems, media inquiries, legal threats, etc.]

### Next Steps
- [Action items for next week]
```

---

## Phase 6: Post-Incident Review (Day 30-60)

### Step 6.1: Close Out Notifications (Day 30-45)

**Verification Checklist:**
- [ ] All affected individuals notified (or substitute notice complete)
- [ ] HHS OCR notification submitted (if required)
- [ ] Media notification issued (if required)
- [ ] State AG notifications sent (if required)
- [ ] All notification confirmations/receipts saved
- [ ] Delivery tracking logs exported and archived

### Step 6.2: Conduct Post-Incident Review Meeting (Day 45-50)

**Attendees:**
- Incident Commander
- Security Lead
- CTO
- Compliance Officer
- Legal Counsel
- Communications Lead

**Agenda:**
1. **Incident Timeline Review**
   - What happened and when?
   - Detection to containment time?
   - Notification completion dates?

2. **Response Effectiveness**
   - What went well?
   - What didn't go well?
   - Were procedures followed?
   - Were timelines met?

3. **Root Cause Analysis**
   - Technical vulnerability
   - Process failure
   - Human error
   - Third-party issue

4. **Preventative Measures**
   - What has been fixed?
   - What additional controls are needed?
   - Budget requests for security tools?
   - Training gaps identified?

5. **Lessons Learned**
   - Update incident response procedures
   - Update breach notification templates
   - Update employee training materials
   - Update vendor contracts/BAAs

### Step 6.3: Document Final Report (Day 50-60)

**Final Breach Report Template:**

```markdown
# Breach Incident Report - INC-<number>

## Executive Summary
[1-page overview for executives/board]

## Incident Details
- Incident Number: INC-<number>
- Date of Breach: [YYYY-MM-DD]
- Date of Discovery: [YYYY-MM-DD]
- Severity Classification: [Level 1-4]
- Individuals Affected: [Exact count]
- PHI Involved: [Types]

## Timeline of Events
[Detailed chronology from breach to resolution]

## Root Cause Analysis
[Technical explanation + contributing factors]

## Response Actions
[What was done and when]

## Notification Compliance
- Individuals: [#] notified via [methods] on [dates]
- HHS: [Submitted / Not Required] on [date]
- Media: [Issued / Not Required] on [date]
- States: [Notified / Not Required]

## Financial Impact
- Notification costs: $[amount]
- Legal fees: $[amount]
- Credit monitoring (if offered): $[amount]
- Regulatory fines (if applicable): $[amount]
- Insurance recovery: $[amount]
- **Total Net Cost:** $[amount]

## Preventative Measures Implemented
1. [Measure 1]
2. [Measure 2]
3. [Measure 3]

## Recommendations
1. [Recommendation 1]
2. [Recommendation 2]
3. [Recommendation 3]

## Appendices
- Appendix A: Audit log exports
- Appendix B: Risk assessment form
- Appendix C: Notification samples
- Appendix D: Regulatory receipts
- Appendix E: Forensic analysis report

---
**Prepared By:** [Name, Title]  
**Date:** [YYYY-MM-DD]  
**Classification:** Attorney-Client Privileged / Confidential
```

### Step 6.4: Archive and Retain (Day 60)

**Retention Requirements:**
- HIPAA: 6 years from incident date
- State Laws: Varies (typically 3-7 years)
- **VitaLuxePro Policy:** 7 years minimum

**Archive Location:**
```
s3://vitaluxe-compliance/breach-incidents/
  INC-<number>/
    ├── incident_report.pdf
    ├── risk_assessment.pdf
    ├── notification_samples/
    ├── audit_logs/
    ├── forensic_analysis/
    ├── regulatory_receipts/
    └── chain_of_custody.pdf
```

**Access Controls:**
- Encrypt at rest (AES-256)
- Access restricted to: Legal, Compliance, Security Lead
- MFA required
- Access logged

### Step 6.5: Update Procedures (Ongoing)

**Documents to Update Based on Lessons Learned:**
1. This playbook (`breach_response_playbook.md`)
2. `breach_notification_procedure.md`
3. `breach_severity_matrix.md`
4. `alert_policies.json`
5. Employee security training materials
6. Vendor contracts and BAAs
7. Incident response runbooks

**Continuous Improvement:**
- Schedule annual tabletop exercises
- Review procedures after each incident (even small ones)
- Benchmark against industry best practices
- Stay updated on regulatory changes

---

## Quick Reference Checklists

### Level 4 (CRITICAL) Breach Checklist

- [ ] **Hour 0-1:** Detect, assemble team, initial containment
- [ ] **Hour 1-4:** Complete containment, preserve evidence, root cause
- [ ] **Hour 4-24:** Investigation, risk assessment, confirm severity
- [ ] **Hour 24-48:** Draft notifications, prepare HHS/media statements
- [ ] **Within 24 hours:** Notify affected individuals (expedited)
- [ ] **Within 60 days:** Submit HHS OCR notification (if ≥500)
- [ ] **Within 60 days:** Issue media press release (if ≥500 in state)
- [ ] **Day 30-60:** Post-incident review, final report, archive

### Level 3 (HIGH) Breach Checklist

- [ ] **Hour 0-1:** Detect, assemble team, initial containment
- [ ] **Hour 1-4:** Complete containment, preserve evidence
- [ ] **Hour 4-24:** Investigation, risk assessment
- [ ] **Day 2-7:** Draft notifications
- [ ] **Within 7 days:** Notify affected individuals
- [ ] **Within 60 days:** Submit HHS OCR notification (if ≥500)
- [ ] **Day 30-60:** Post-incident review, final report

### Level 2 (MEDIUM) Breach Checklist

- [ ] **Hour 0-1:** Detect, assess, initial containment
- [ ] **Hour 1-4:** Investigation, evidence preservation
- [ ] **Day 1-30:** Risk assessment, draft notifications
- [ ] **Within 30 days:** Notify affected individuals (if required)
- [ ] **Day 30-60:** Post-incident review

### Level 1 (LOW) Breach Checklist

- [ ] **Hour 0-1:** Detect, assess
- [ ] **Day 1:** Risk assessment (HIPAA 4-factor test)
- [ ] **Day 1-60:** Document "low harm" determination (if no notification)
- [ ] **If notification required:** Follow Level 2 procedures
- [ ] **Annual:** Include in HHS annual report (if <500 breaches)

---

## Appendices

### Appendix A: Key Contacts (Quick Reference)

| Role | Name | Email | Phone | After-Hours |
|------|------|-------|-------|-------------|
| Incident Commander | [Name] | security@vitaluxepro.com | [Phone] | [Phone] |
| CTO | [Name] | [Email] | [Phone] | [Phone] |
| Compliance Officer | [Name] | compliance@vitaluxepro.com | [Phone] | [Phone] |
| Legal Counsel | [Firm] | [Email] | [Phone] | [Phone] |
| PR/Communications | [Name] | pr@vitaluxepro.com | [Phone] | [Phone] |

### Appendix B: External Resources

- **HHS OCR Breach Portal:** https://ocrportal.hhs.gov/ocr/breach/wizard_breach.jsf
- **HHS Guidance:** https://www.hhs.gov/hipaa/for-professionals/breach-notification/index.html
- **State Breach Laws:** https://www.ncsl.org/research/telecommunications-and-information-technology/security-breach-notification-laws.aspx
- **FTC Identity Theft Resources:** https://www.identitytheft.gov/

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-17  
**Next Review:** 2026-11-17  
**Owner:** Security & Compliance Team  
**Location:** `ops/compliance/breach_response_playbook.md`
