# VitaLuxe Security Documentation

## Overview
This document outlines the comprehensive security measures implemented in the VitaLuxe application, covering data protection, access control, audit logging, and compliance requirements.

---

## 🔐 Critical Security Features

### 1. Data Encryption at Rest

**PHI/PII Encryption:**
- Patient PHI (allergies, notes) encrypted using AES-256
- Prescription data (URLs, dosage, sig) encrypted
- Payment methods (Plaid tokens) encrypted
- Automatic encryption via database triggers

**Encryption Keys:**
- Stored in `encryption_keys` table with RLS enabled
- Recommended rotation: Every 90 days
- Admins can monitor key age in Security → Encryption tab

**Implementation:**
```sql
-- Encryption happens automatically via triggers:
- encrypt_patient_phi_trigger (patients table)
- encrypt_prescription_trigger (order_lines table)
- Payment method encryption on insert/update
```

---

### 2. Row-Level Security (RLS)

**All sensitive tables have RLS enabled:**

| Table | Access Control |
|-------|----------------|
| `patients` | Practice-scoped, PHI protection |
| `order_lines` | Doctor/pharmacy/admin only |
| `practice_payment_methods` | Practice-owner + admin only |
| `encryption_keys` | Admin read-only |
| `audit_logs` | Admin read-only |
| `cart_lines` | Time-restricted (30 days) |

**Role-based access via `has_role()` function:**
- Prevents privilege escalation
- Uses security definer functions to avoid RLS recursion
- Roles stored in separate `user_roles` table

---

### 3. Comprehensive Audit Logging

**All sensitive actions are logged:**
- PHI access (patient records)
- Prescription access (order lines)
- Payment method access
- Authentication events
- Administrative actions
- Address verification changes

**Audit Log Features:**
- Automatic archival after 90 days → `audit_logs_archive`
- 6-year retention for HIPAA compliance
- Export to CSV for compliance reporting
- Real-time monitoring in Security dashboard

**Implementation:**
```typescript
// Automatic logging via triggers on all sensitive tables
// Logs capture: user_id, user_email, user_role, action_type, entity_id, timestamp
```

---

## 🛡️ Security Monitoring & Alerts

### Real-time Security Alerts

**Pre-configured Alert Rules:**

| Alert | Threshold | Severity | Action |
|-------|-----------|----------|--------|
| High Volume PHI Access | >50 records/hour | High | Email notification |
| Encryption Failure | 1 failure | Critical | Immediate alert |
| Suspicious Prescription Access | >10 unassigned/hour | High | Email + log |
| Payment Method Bulk Access | >10 in 5 min | High | Email + log |
| Failed Login Spike | >10 in 15 min | Medium | Email |
| Cross-Practice Access | >5 in 30 min | Critical | Email + log |

**Alert Management:**
- Configure in Security → Alerts tab
- Customize thresholds and recipients
- Enable/disable rules as needed

---

### Security Dashboard Components

**1. Overview Tab:**
- Security health score
- Encryption coverage percentage
- Recent error activity
- RLS status
- PHI access count (24h)

**2. PHI Access Tab:**
- Real-time monitoring of patient data access
- Filter by entity type, date range, user
- Export for compliance audits
- Suspicious pattern detection

**3. Encryption Tab:**
- Encryption key rotation status
- Data encryption coverage:
  - Patients with encrypted PHI
  - Orders with encrypted prescriptions
  - Payment methods encrypted
- Warning if key >90 days old

**4. Prescriptions Tab:**
- DEA-compliant audit log
- Track all prescription access
- Export for regulatory compliance
- Search by patient/provider

**5. Banking Security Tab:**
- Payment method access audit
- Suspicious activity detection
- Bulk access alerts
- IP tracking

**6. Security Events Tab:**
- High-level security event summary
- Aggregated from materialized view
- Real-time threat detection

---

## 🔒 Access Control Matrix

### Role Permissions

| Resource | Admin | Doctor | Provider | Pharmacy | Topline | Downline |
|----------|-------|--------|----------|----------|---------|----------|
| All Patients | ✅ | Own Practice | Own Practice | Assigned Orders | Downline Practices | Assigned Practices |
| Order Lines | ✅ | Own Orders | Own Orders | Assigned Only | Downline Orders | Assigned Orders |
| Payment Methods | ✅ | Own Practice | ❌ | ❌ | ❌ | ❌ |
| Audit Logs | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Encryption Keys | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Security Dashboard | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 📊 Compliance & Reporting

### HIPAA Compliance

**Protected Health Information (PHI):**
- ✅ Encrypted at rest (AES-256)
- ✅ Encrypted in transit (TLS 1.3)
- ✅ Access logging (all PHI access tracked)
- ✅ 6-year audit retention
- ✅ Role-based access control
- ✅ Automatic data archival

**Compliance Reporting:**
```sql
-- View current compliance status
SELECT * FROM public.security_compliance_report;
```

**Checks:**
- Encryption keys rotated (every 90 days)
- Audit logs retention (6 years)
- Active security alerts (≥5 rules)
- RLS enabled on critical tables

---

### DEA Compliance (Prescriptions)

**Requirements Met:**
- ✅ All prescription access logged
- ✅ Timestamp + user + patient tracked
- ✅ Immutable audit trail
- ✅ Export capability for inspections
- ✅ Encrypted prescription data

**Access via:**
Security → Prescriptions → Export for Compliance

---

## 🚨 Incident Response

### Security Event Detection

**Automated Detection:**
1. Alert rules trigger on threshold breach
2. Event logged to `alerts` table
3. Email notification sent to admins
4. Security dashboard updates in real-time

**Manual Investigation:**
1. Navigate to Security → Security Events
2. Filter by severity/time range
3. View detailed event information
4. Export for forensic analysis

### Account Lockout Process

**Automatic Lockouts:**
- Brute force detection (via edge function)
- Multiple failed logins
- Suspicious access patterns

**Lockout Management:**
- View in Security → Lockouts tab
- Admins can unlock accounts
- Lockout reasons logged
- IP address tracking

---

## 🔧 Security Best Practices

### For Administrators

1. **Monitor Security Dashboard Daily:**
   - Check security health score
   - Review recent errors
   - Verify encryption coverage

2. **Rotate Encryption Keys:**
   - Every 90 days (automatic warning)
   - Use Security → Encryption tab
   - Verify new key is active

3. **Review Audit Logs Weekly:**
   - Check for unusual PHI access patterns
   - Monitor cross-practice access attempts
   - Export logs for compliance

4. **Configure Alert Recipients:**
   - Add admin emails to alert rules
   - Test alert notifications
   - Set appropriate thresholds

### For Developers

1. **Never Disable RLS:**
   - All sensitive tables must have RLS
   - Use `has_role()` for permission checks
   - Test policies thoroughly

2. **Use Encryption Functions:**
   - PHI data: `encrypt_patient_phi()`
   - Prescriptions: `encrypt_prescription_data()`
   - Plaid tokens: `encrypt_plaid_token()`

3. **Log All Sensitive Actions:**
   - Use `log_audit_event()` function
   - Include entity_id and details
   - Capture user context

4. **Search Path on SECURITY DEFINER:**
   - Always add `SET search_path TO 'public'`
   - Prevents SQL injection
   - Required for production

---

## 📋 Security Checklist

### Pre-Production Checklist

- [x] Encryption triggers enabled
- [x] RLS policies on all sensitive tables
- [x] Audit logging configured
- [x] Security alerts active (≥5 rules)
- [x] Encryption key rotation schedule set
- [x] Leaked password protection enabled
- [x] Rate limiting configured
- [x] Search paths on SECURITY DEFINER functions
- [x] Compliance reporting view created
- [x] Security dashboard accessible

### Monthly Maintenance

- [ ] Review encryption key age
- [ ] Export audit logs for backup
- [ ] Check security compliance report
- [ ] Review failed login attempts
- [ ] Update alert rule thresholds
- [ ] Test account lockout process
- [ ] Verify backup restoration

### Quarterly Reviews

- [ ] Rotate encryption keys
- [ ] Archive old audit logs
- [ ] Review RLS policy effectiveness
- [ ] Update security documentation
- [ ] Conduct security training
- [ ] Test disaster recovery

---

## 🆘 Support & Resources

### Security Dashboard Access
Navigate to: `/security` (Admin role required)

### Key Functions
- `has_role(user_id, role)` - Check user permissions
- `log_audit_event(action, entity_type, entity_id, details)` - Manual logging
- `archive_old_audit_logs()` - Manual archival trigger
- `validate_discount_code(code)` - Secure code validation

### Database Tables
- `audit_logs` - Recent activity logs
- `audit_logs_archive` - Historical logs (>90 days)
- `encryption_keys` - Active encryption keys
- `alert_rules` - Security alert configuration
- `alerts` - Triggered security events
- `failed_login_attempts` - Login failure tracking
- `account_lockouts` - Locked user accounts

---

## 📞 Emergency Contacts

**Security Incident:**
1. Check Security → Security Events for details
2. Review Audit Logs for timeline
3. Document findings
4. Contact system administrator

**Data Breach:**
1. Immediately lock affected accounts
2. Export audit logs for investigation
3. Notify compliance officer
4. Follow HIPAA breach notification protocol

---

**Last Updated:** 2025-10-14  
**Version:** 1.0  
**Status:** Production Ready ✅