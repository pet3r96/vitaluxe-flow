# VitaLuxePro Breach Notification Procedure

**Version:** 1.0  
**Effective Date:** 2025-11-17  
**Last Updated:** 2025-11-17  
**Owner:** Compliance Officer & Security Team  
**Review Cycle:** Annually or after any breach incident

---

## Table of Contents

1. [Overview](#overview)
2. [Legal Requirements](#legal-requirements)
3. [Breach Detection & Classification](#breach-detection--classification)
4. [Notification Timelines](#notification-timelines)
5. [Who Must Be Notified](#who-must-be-notified)
6. [Notification Procedures](#notification-procedures)
7. [Evidence Preservation](#evidence-preservation)
8. [Communication Templates](#communication-templates)
9. [Post-Incident Review](#post-incident-review)

---

## Overview

This procedure defines the process for detecting, assessing, responding to, and reporting security breaches involving Protected Health Information (PHI) or Personally Identifiable Information (PII) in compliance with:

- **HIPAA Breach Notification Rule** (45 CFR §§ 164.400-414)
- **HITECH Act** Enhanced Enforcement
- **State Breach Notification Laws** (varies by state)
- **FTC Health Breach Notification Rule** (for PHR vendors)

**Key Principle:** When in doubt, report. Over-notification is preferable to under-notification from a compliance perspective.

---

## Legal Requirements

### Federal Law (HIPAA/HITECH)

**HIPAA Breach Definition:**  
An impermissible use or disclosure under the Privacy Rule that compromises the security or privacy of PHI, excluding disclosures that pose low probability of harm (via risk assessment).

**HITECH Breach Presumption:**  
Any impermissible disclosure is PRESUMED to be a breach unless the covered entity demonstrates low probability of harm through a formal risk assessment.

**Required Risk Assessment Factors (45 CFR § 164.402):**
1. Nature and extent of PHI involved (diagnosis, treatment, lab results)
2. Unauthorized person who accessed PHI (malicious actor vs. employee error)
3. Whether PHI was actually acquired or viewed
4. Extent to which risk has been mitigated

**Notification Deadlines:**
- **Individuals:** 60 calendar days from discovery
- **HHS (OCR):** 60 days for breaches affecting ≥ 500 individuals
- **Media:** Immediately for breaches affecting ≥ 500 individuals in a state/jurisdiction
- **HHS Annual Report:** Annually for breaches affecting < 500 individuals

### State Laws (Examples - Verify State-Specific Requirements)

| State | Notification Deadline | Threshold | Attorney General Notice | Media Notice |
|-------|----------------------|-----------|------------------------|--------------|
| California (CMIA) | Without unreasonable delay | Any breach | Yes, if > 500 residents | No |
| New York | Without unreasonable delay | Any breach | Attorney General | No |
| Texas | 60 days | Any breach | Attorney General | No |
| Florida | 30 days | Any breach | No | No |
| Massachusetts | As soon as practicable | Any breach | Attorney General + Consumer Affairs | No |

**Note:** Always consult with legal counsel to confirm state-specific requirements.

---

## Breach Detection & Classification

### Detection Sources

1. **Automated Monitoring**
   - Alert policy violations (see `alert_policies.json`)
   - Audit log anomalies
   - RLS policy violations
   - Failed authentication spikes
   - PHI access anomalies

2. **Manual Reporting**
   - Employee reports via security@vitaluxepro.com
   - Patient complaints
   - Third-party vendor notifications
   - Law enforcement notifications

3. **Security Assessments**
   - Penetration testing findings
   - Vulnerability scans
   - Code reviews
   - Compliance audits

### Immediate Actions Upon Detection (Within 1 Hour)

1. **Contain the incident**
   - Isolate affected systems
   - Revoke compromised credentials
   - Block malicious IPs
   - Disable affected accounts

2. **Preserve evidence**
   - Take database snapshots
   - Export audit logs
   - Capture system logs
   - Document all actions taken

3. **Notify incident response team**
   - Security Lead
   - Compliance Officer
   - Legal Counsel
   - CTO

4. **Initiate risk assessment**
   - Use breach severity matrix (see `breach_severity_matrix.md`)
   - Document findings in incident report

---

## Notification Timelines

### Decision Tree

```
Breach Detected
    ↓
Risk Assessment (24 hours)
    ↓
Low Probability of Harm? ───Yes──→ Document & Monitor (No notification)
    ↓ No
    ↓
Classify Severity (Level 1-4)
    ↓
┌───────────────────┬────────────────────┬────────────────────┐
│ Level 4 (Critical)│ Level 3 (High)     │ Level 2 (Medium)   │
│ Notify: 24 hours  │ Notify: 7 days     │ Notify: 30 days    │
│ • Individuals     │ • Individuals      │ • Individuals      │
│ • HHS (if ≥500)   │ • HHS (if ≥500)    │ • HHS (if ≥500)    │
│ • Media (if ≥500) │                    │                    │
│ • States          │                    │                    │
│ • Law Enforcement │                    │                    │
└───────────────────┴────────────────────┴────────────────────┘
```

### Clock Starts When...

**"Discovery"** = The first day on which the breach is known or should have been known by exercising reasonable diligence.

**Examples:**
- Automated alert fires → Discovery = alert timestamp
- Employee reports suspicious activity → Discovery = report date
- Audit reveals historical breach → Discovery = audit completion date

**Important:** Clock does NOT pause during investigation. Notification deadline is absolute.

---

## Who Must Be Notified

### Tier 1: Affected Individuals (ALWAYS)

**Notification Methods (in order of preference):**
1. **First-class mail** (HIPAA default)
2. **Email** (if individual provided authorization for electronic communications)
3. **Substitute notice** (if contact info insufficient for ≥10 individuals):
   - Conspicuous posting on website for 90 days
   - Notice in major print/broadcast media (if ≥ 500 in state/jurisdiction)

**Special Cases:**
- **Deceased individuals:** Notify next of kin or personal representative
- **Minors:** Notify parent or guardian

### Tier 2: Federal Government

**HHS Office for Civil Rights (OCR):**
- **≥ 500 individuals:** Within 60 days via online portal
- **< 500 individuals:** Annual report (due within 60 days of calendar year end)
- Portal: https://ocrportal.hhs.gov/ocr/breach/wizard_breach.jsf

### Tier 3: Media (for large breaches)

**Requirement:** Breaches affecting ≥ 500 individuals in a state or jurisdiction

**Process:**
1. Identify major media outlets in affected state(s)
2. Issue press release within 60 days
3. Document all media outreach

### Tier 4: State Attorneys General

**Varies by state.** Common requirements:
- California: Yes (if ≥ 500 CA residents)
- New York: Yes (any breach)
- Texas: Yes (any breach)
- Check state-specific laws

### Tier 5: Other Entities

- **Business Associates:** If breach occurred at BA, BA notifies CE within 60 days
- **Subcontractors:** Same as BA requirements
- **Credit Bureaus:** If breach involves SSNs (required by some states)
- **Law Enforcement:** Optional unless requested by authorities to delay notification

---

## Notification Procedures

### Individual Notification Content (Required Elements)

Per 45 CFR § 164.404, notification must include:

1. **Brief description of what happened**
   - Date of breach (or estimated timeframe)
   - Date breach was discovered
2. **Types of PHI involved**
   - E.g., names, SSNs, medical diagnoses, treatment records
3. **Steps individuals should take to protect themselves**
   - E.g., monitor credit reports, change passwords, watch for phishing
4. **What VitaLuxePro is doing to investigate and mitigate**
5. **Contact information**
   - Dedicated breach response hotline
   - Email: breach-response@vitaluxepro.com
   - Toll-free number: 1-800-XXX-XXXX

**Prohibited Content:**
- Do NOT include unnecessary details that could aid attackers
- Do NOT speculate on cause if investigation ongoing
- Do NOT minimize severity (but be factual)

### HHS Notification

**Process:**
1. Log into HHS OCR Breach Notification Portal
2. Complete online form with:
   - Number of affected individuals
   - Date of breach
   - Date of discovery
   - Brief description
   - Contact information
3. Submit within 60 days
4. Save confirmation receipt

**Form Fields:**
- Covered Entity name, address, contact
- Number of affected individuals (exact or estimated)
- Breach submission category
- Location of breached information
- Type of breach (hacking, unauthorized access, theft, loss, improper disposal, other)
- Date of breach
- Date of discovery
- Brief description (500 characters max)

### Media Notification

**Sample Press Release Outline:**
```
FOR IMMEDIATE RELEASE
[Date]

VitaLuxePro Notifies [Number] Individuals of Data Security Incident

[City, State] – VitaLuxePro is notifying individuals whose information 
may have been affected by a data security incident discovered on [Date].

What Happened: [Brief, factual summary]

What Information Was Involved: [Types of PHI]

What We Are Doing: [Investigation, remediation, security enhancements]

What Individuals Should Do: [Actionable steps]

For More Information: 
- Dedicated hotline: 1-800-XXX-XXXX (M-F 9am-6pm ET)
- Email: breach-response@vitaluxepro.com
- Website: www.vitaluxepro.com/breach-response

###

Contact:
[Name]
[Title]
[Email]
[Phone]
```

---

## Evidence Preservation

### Immediate Snapshots (Within 1 Hour)

1. **Database Snapshot**
   ```bash
   # Automated script triggered by incident response team
   pg_dump -h [DB_HOST] -U [USER] -Fc -f breach_snapshot_$(date +%Y%m%d_%H%M%S).dump [DB_NAME]
   ```

2. **Audit Log Export**
   ```sql
   -- Export audit logs for past 90 days
   COPY (
     SELECT * FROM audit_logs 
     WHERE created_at > now() - interval '90 days'
     ORDER BY created_at DESC
   ) TO '/secure/exports/audit_logs_incident_[ID]_[DATE].csv' CSV HEADER;
   ```

3. **Application Logs**
   ```bash
   # Export edge function logs
   supabase functions logs [function-name] --tail 10000 > logs_[function]_[DATE].txt
   ```

4. **Network Logs**
   - Firewall logs
   - Load balancer access logs
   - Supabase connection logs

### Chain of Custody

**Log Template:**
| Date/Time | Action Taken | Person Responsible | Location/System | Hash/Checksum |
|-----------|--------------|-------------------|-----------------|---------------|
| 2025-01-15 10:32 | Database snapshot | John Doe | prod-db-01 | sha256:abc123... |
| 2025-01-15 10:45 | Audit logs exported | Jane Smith | Supabase | sha256:def456... |

### Retention Requirements

- **HIPAA:** 6 years from incident date
- **State Laws:** Varies (typically 3-7 years)
- **VitaLuxePro Policy:** 7 years minimum

**Storage:**
- Encrypted at rest (AES-256)
- Access restricted to incident response team + legal
- Store in immutable S3 bucket with MFA delete

---

## Communication Templates

### Template 1: Individual Notification Letter (Mailed)

See `ops/compliance/templates/breach_notification_letter.docx`

**Key Sections:**
- VitaLuxePro letterhead
- Date
- Recipient name and address
- RE: Notice of Data Security Incident
- Body (per HIPAA requirements above)
- Steps to protect yourself
- Contact information
- Signature of Privacy Officer or CEO

### Template 2: Email Notification (If Authorized)

See `ops/compliance/templates/breach_notification_email.html`

**Subject:** Important Security Notice from VitaLuxePro

**Body:**
- HTML formatted with brand styling
- Same content as mailed letter
- Unsubscribe NOT allowed (regulatory notice)
- Footer with contact info

### Template 3: Website Substitute Notice

See `ops/compliance/templates/breach_notification_website_banner.html`

**Display Requirements:**
- Prominent placement on homepage
- Visible for 90 days minimum
- Include all required HIPAA elements
- Link to FAQ page

### Template 4: HHS OCR Submission

Prepared via online portal (no template needed, but pre-populate data from incident report)

---

## Post-Incident Review

### Required Within 30 Days of Breach Resolution

**Review Agenda:**
1. **Incident Timeline**
   - What happened and when
   - Detection to containment time
   - Notification completion dates

2. **Root Cause Analysis**
   - Technical vulnerability exploited
   - Process failure (if applicable)
   - Human error factors

3. **Effectiveness Assessment**
   - Did alerting work as expected?
   - Were response procedures followed?
   - Was notification timely and compliant?

4. **Lessons Learned**
   - What worked well?
   - What needs improvement?
   - Training gaps identified?

5. **Action Items**
   - Technical fixes implemented
   - Policy updates required
   - Additional training needed
   - Budget requests for security tools

### Documentation

**Final Report Sections:**
1. Executive Summary
2. Incident Details
3. Response Actions
4. Notification Compliance
5. Financial Impact
6. Preventative Measures
7. Recommendations

**Distribution:**
- CTO
- Compliance Officer
- Legal Counsel
- Board of Directors (for Level 3-4 breaches)
- Insurance carrier (if cyber insurance claim)

### Continuous Improvement

**Update the following documents based on lessons learned:**
- This procedure document
- `breach_severity_matrix.md`
- `breach_response_playbook.md`
- `alert_policies.json`
- Employee training materials
- Incident response runbooks

---

## Appendices

### Appendix A: Key Contacts

| Role | Name | Email | Phone | Backup |
|------|------|-------|-------|--------|
| Privacy Officer | [Name] | privacy@vitaluxepro.com | [Phone] | [Backup Name] |
| Security Lead | [Name] | security@vitaluxepro.com | [Phone] | [Backup Name] |
| Legal Counsel | [Firm] | [Email] | [Phone] | [Backup] |
| PR/Communications | [Name] | pr@vitaluxepro.com | [Phone] | [Backup Name] |
| HHS OCR | Regional Office | [Email] | [Phone] | N/A |

### Appendix B: Regulatory References

- [HIPAA Breach Notification Rule](https://www.hhs.gov/hipaa/for-professionals/breach-notification/index.html)
- [HHS Guidance on Risk Assessment](https://www.hhs.gov/hipaa/for-professionals/breach-notification/guidance/index.html)
- [State Breach Laws Comparison](https://www.ncsl.org/research/telecommunications-and-information-technology/security-breach-notification-laws.aspx)

### Appendix C: Vendor BAA Review

**Post-Breach Action:** Review all Business Associate Agreements for breach notification clauses. Ensure:
- BA must notify CE within 60 days of breach discovery
- BA provides sufficient detail for CE to conduct risk assessment
- BA cooperates with CE's investigation

---

**Approval Signatures:**

**Privacy Officer:** _______________________ Date: _________

**CTO:** _______________________ Date: _________

**Legal Counsel:** _______________________ Date: _________

---

**Document Control:**
- **Version:** 1.0
- **Next Review Date:** 2026-11-17
- **Location:** `ops/compliance/breach_notification_procedure.md`
- **Classification:** Internal Use Only
