# Breach Severity Classification Matrix

**Version:** 1.0  
**Effective Date:** 2025-11-17  
**Owner:** Security & Compliance Team

---

## Purpose

This matrix provides objective criteria for classifying security breaches involving Protected Health Information (PHI) or Personally Identifiable Information (PII) to ensure consistent response and appropriate notification timelines.

---

## Severity Levels Overview

| Level | Name | Notification Timeline | Escalation | Examples |
|-------|------|----------------------|------------|----------|
| **4** | **CRITICAL** | 24 hours | CEO, Board, HHS, Media | Mass PHI exposure, ransomware, intentional exfiltration |
| **3** | **HIGH** | 7 days | CTO, Legal, HHS (if ≥500) | Unauthorized access to ≥100 records, lost unencrypted device |
| **2** | **MEDIUM** | 30 days | Security Lead, Compliance | Unauthorized access to <100 records, misconfigured permission |
| **1** | **LOW** | 60 days or No notification | Security Lead (monitor) | Minimal PHI exposed, low harm probability |

---

## Level 4: CRITICAL Breach

### Criteria (Any ONE triggers Level 4)

- ✅ **≥ 500 individuals affected** (triggers HHS + Media notification)
- ✅ **Sensitive PHI categories exposed:**
  - HIV status
  - Mental health diagnoses
  - Substance abuse records
  - Genetic information
  - Sexual health records
- ✅ **Evidence of malicious intent:**
  - Ransomware attack
  - Deliberate exfiltration
  - Nation-state actor
  - Insider threat (intentional)
- ✅ **Financial fraud potential:**
  - PHI + SSN + payment card data exposed together
  - Active use of stolen data detected
- ✅ **Media/public disclosure:**
  - Breach already leaked to press
  - Social media attention
  - Regulatory inquiry initiated

### Required Actions (Within 24 Hours)

1. **Immediate Containment**
   - Isolate affected systems
   - Revoke all credentials
   - Engage forensics firm

2. **Notifications**
   - Affected individuals (expedited)
   - HHS OCR (if ≥ 500)
   - Major media outlets (if ≥ 500 in state)
   - State Attorneys General
   - Law enforcement (FBI Cyber Division)
   - Cyber insurance carrier

3. **Legal Actions**
   - Retain outside counsel
   - Preserve all evidence
   - Prepare for potential litigation

4. **Public Relations**
   - Draft press release
   - Prepare FAQ document
   - Set up dedicated breach response hotline
   - Update website with incident notice

### Escalation Path

CEO → Board of Directors → HHS → Law Enforcement → Media

### Example Scenarios

**Example 1: Ransomware Attack**
- Ransomware encrypts production database containing 2,000 patient records
- Attackers demand payment and threaten to publish data
- **Classification:** Level 4 (≥500 affected + malicious intent + financial fraud potential)

**Example 2: Mass Data Exfiltration**
- Security logs show unauthorized access to 1,500 patient records over 72 hours
- Attacker downloaded PHI including diagnoses, treatment plans, SSNs
- **Classification:** Level 4 (≥500 affected + evidence of exfiltration)

---

## Level 3: HIGH Breach

### Criteria (Any ONE triggers Level 3)

- ✅ **100-499 individuals affected**
- ✅ **Unencrypted device loss/theft:**
  - Laptop with patient database
  - Unencrypted backup drive
  - USB drive with PHI
- ✅ **Extended unauthorized access:**
  - Access persisted for > 48 hours before detection
  - Multiple systems compromised
- ✅ **Authentication bypass:**
  - RLS policy violation allowing cross-practice data access
  - Privilege escalation exploit
- ✅ **Third-party breach:**
  - Business Associate reports breach affecting your PHI
  - Cloud provider security incident

### Required Actions (Within 7 Days)

1. **Investigation**
   - Complete forensic analysis
   - Determine scope of access
   - Conduct risk assessment (HIPAA 4-factor test)

2. **Notifications**
   - Affected individuals (first-class mail)
   - HHS OCR (if ≥ 500, but unlikely at this level)
   - State AG (if required by state law)

3. **Remediation**
   - Patch vulnerabilities
   - Implement additional controls
   - Conduct post-incident review

4. **Monitoring**
   - Enhanced logging for 90 days
   - Credit monitoring for affected individuals (if SSN exposed)

### Escalation Path

Security Lead → CTO → Legal Counsel → HHS (if ≥500)

### Example Scenarios

**Example 1: Stolen Unencrypted Laptop**
- Employee's laptop stolen from vehicle
- Laptop contained local copy of 350 patient records (names, DOB, diagnoses)
- Disk encryption was NOT enabled
- **Classification:** Level 3 (100-499 affected + unencrypted device loss)

**Example 2: Business Associate Breach**
- Pharmacy partner notifies of database breach affecting 200 patients
- PHI exposed includes patient names, medications, addresses
- **Classification:** Level 3 (100-499 affected + third-party breach)

---

## Level 2: MEDIUM Breach

### Criteria (Any ONE triggers Level 2)

- ✅ **10-99 individuals affected**
- ✅ **Misconfigured access control:**
  - Provider saw patients outside their practice for limited time
  - Staff accessed records without authorization
- ✅ **Email misdirection:**
  - PHI sent to wrong recipient (limited records)
  - Cc instead of Bcc on group email
- ✅ **Improper disposal:**
  - Paper records not shredded
  - Backup tapes not destroyed properly
- ✅ **Vendor misconfiguration:**
  - S3 bucket temporarily public
  - Database snapshot exposed (but quickly secured)

### Required Actions (Within 30 Days)

1. **Assessment**
   - Risk assessment (HIPAA 4-factor test)
   - Determine if notification required (may result in "low harm" determination)

2. **Notifications (If Required)**
   - Affected individuals
   - HHS annual report (breaches < 500)

3. **Corrective Actions**
   - Update procedures to prevent recurrence
   - Additional staff training
   - Configuration review

### Escalation Path

Security Lead → Compliance Officer → Legal (consultation)

### Example Scenarios

**Example 1: Misconfigured RLS Policy**
- RLS policy bug allowed Doctor A to view 45 patients from Doctor B's practice
- Access lasted 6 hours before detection
- No evidence of actual data export
- **Classification:** Level 2 (10-99 affected + misconfigured access)

**Example 2: Email Misdirection**
- Staff member emailed lab results for 12 patients to wrong provider
- Email recalled within 2 hours
- Recipient confirmed deletion without viewing
- **Classification:** Level 2 (10-99 affected, but may result in "no notification" after risk assessment)

---

## Level 1: LOW Breach (May Not Require Notification)

### Criteria (ALL MUST Be True)

- ✅ **< 10 individuals affected**
- ✅ **Limited PHI exposure:**
  - Names and appointment dates only
  - Non-sensitive information
- ✅ **Low harm probability:**
  - Recipient unlikely to retain/misuse data
  - PHI not actually viewed (access logs prove)
  - Data not removed from premises
- ✅ **Immediate mitigation:**
  - Breach contained within 1 hour
  - Data retrieved/deleted
  - Unauthorized person not malicious actor

### Required Actions (Within 60 Days or No Notification)

1. **Risk Assessment**
   - Formal HIPAA 4-factor test documented
   - Determination of "low probability of harm"

2. **Documentation**
   - Incident report filed
   - Risk assessment retained for 6 years

3. **Optional Notification**
   - May still notify affected individuals (best practice)
   - HHS annual report (breaches < 500, if notification waived)

### Escalation Path

Security Lead → Compliance Officer (review only)

### Example Scenarios

**Example 1: Accidental View of Single Record**
- Staff member accidentally clicked on wrong patient record
- Viewed name and appointment date only (no diagnosis or treatment info)
- Immediately closed and reported
- **Classification:** Level 1 (< 10 affected + limited PHI + immediate mitigation)
- **Outcome:** Likely no notification required (risk assessment documents low harm)

**Example 2: Misdirected Fax (Single Patient)**
- Prescription faxed to wrong pharmacy
- Pharmacy immediately notified and confirmed shredding
- **Classification:** Level 1 (1 individual + low harm probability)
- **Outcome:** Optional notification (may still notify patient as courtesy)

---

## HIPAA 4-Factor Risk Assessment (Required for All Breaches)

**Use this framework to determine "low probability of harm" for Level 1-2 breaches:**

### Factor 1: Nature and Extent of PHI Involved

**High Risk:**
- Diagnoses (especially mental health, HIV, substance abuse)
- Treatment plans
- Lab results
- Genetic information
- Social Security Numbers
- Financial information

**Low Risk:**
- Appointment dates
- Names only
- Non-clinical information

### Factor 2: Unauthorized Person Who Accessed PHI

**High Risk:**
- Malicious actor (hacker, identity thief)
- Unknown external party
- Competitor

**Low Risk:**
- Healthcare provider (wrong practice)
- Employee without malicious intent
- Known, trusted recipient

### Factor 3: Whether PHI Was Actually Acquired or Viewed

**High Risk:**
- Data downloaded/copied
- Screenshots taken
- Printed copies
- Audit logs confirm viewing

**Low Risk:**
- Access granted but no evidence of viewing
- Email sent but unopened
- Document retrieved immediately

### Factor 4: Extent to Which Risk Has Been Mitigated

**High Risk:**
- Mitigation not possible (data already public)
- Cannot confirm deletion
- Ongoing exposure

**Low Risk:**
- Data retrieved and confirmed deleted
- Recipient signed confidentiality agreement
- Encryption applied post-exposure (device recovered)

### Decision Matrix

| Factor 1 | Factor 2 | Factor 3 | Factor 4 | Notification Required? |
|----------|----------|----------|----------|------------------------|
| High | High | High | Low | YES |
| High | High | Low | High | MAYBE (legal review) |
| Low | Low | Low | High | NO (document assessment) |
| High | Low | Low | High | MAYBE (err on side of notification) |

**Rule of Thumb:** If ANY factor is "High" AND mitigation is "Low", notification is likely required.

---

## Special Considerations

### Timing of Discovery

**Discovery Date ≠ Breach Date**

- **Breach Date:** When unauthorized access/disclosure occurred
- **Discovery Date:** When organization knew or should have known

**Notification clock starts on Discovery Date, but breach report must include Breach Date.**

### Aggregation of Small Incidents

**Scenario:** Multiple incidents affecting <10 individuals each, but same root cause.

**Rule:** If incidents stem from same systemic flaw, aggregate counts for severity classification.

**Example:**
- 5 separate email misdirection incidents over 2 weeks
- Each affected 5-8 patients
- Total: 35 patients
- **Classification:** Aggregate to Level 2 (10-99 affected)

### Ongoing Breaches

**Scenario:** Breach persists over time (e.g., misconfigured system for 30 days).

**Rule:** Classify based on TOTAL affected individuals, not daily count.

**Example:**
- RLS policy bug exposed 10 patients/day for 30 days
- Total: 300 patients (with overlap)
- **Classification:** Level 3 (100-499 affected)

---

## Documentation Requirements

For EVERY incident, regardless of severity, document:

1. **Incident Details**
   - Date/time of breach
   - Date/time of discovery
   - How discovered (alert, report, audit, etc.)

2. **Affected Individuals**
   - Number of individuals
   - Types of PHI exposed
   - Duration of exposure

3. **Risk Assessment**
   - HIPAA 4-factor analysis
   - Severity classification (Level 1-4)
   - Notification determination

4. **Response Actions**
   - Containment steps
   - Mitigation measures
   - Notifications sent

5. **Preventative Measures**
   - Root cause
   - Corrective actions
   - Policy/procedure updates

**Retention:** 6 years minimum (HIPAA requirement)

---

## Approval & Review

**Approved By:**
- Security Lead
- Compliance Officer
- Legal Counsel

**Review Cycle:** Annually or after any Level 3-4 breach

**Last Updated:** 2025-11-17

---

## Quick Reference Chart

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BREACH SEVERITY QUICK GUIDE                      │
├─────────┬──────────────┬─────────────────┬─────────────────────────┤
│ Level 4 │ CRITICAL     │ 24 hours        │ ≥500 affected           │
│         │ 🔴           │                 │ Malicious intent        │
│         │              │                 │ Sensitive PHI           │
├─────────┼──────────────┼─────────────────┼─────────────────────────┤
│ Level 3 │ HIGH         │ 7 days          │ 100-499 affected        │
│         │ 🟠           │                 │ Unencrypted device loss │
├─────────┼──────────────┼─────────────────┼─────────────────────────┤
│ Level 2 │ MEDIUM       │ 30 days         │ 10-99 affected          │
│         │ 🟡           │                 │ Misconfiguration        │
├─────────┼──────────────┼─────────────────┼─────────────────────────┤
│ Level 1 │ LOW          │ 60 days or none │ <10 affected            │
│         │ 🟢           │                 │ Low harm probability    │
└─────────┴──────────────┴─────────────────┴─────────────────────────┘
```

---

**Document Location:** `ops/compliance/breach_severity_matrix.md`  
**Next Review:** 2026-11-17
