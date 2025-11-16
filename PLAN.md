# Database Schema Audit & Migration Plan
**Date:** 2025-11-16  
**Status:** AWAITING APPROVAL - NO CHANGES EXECUTED

---

## 0. Current State Confirmation

✅ **Reverted to pre-Phase-6 commit** - UI and core functionality intact  
✅ **Schema snapshot** would be exported via `pg_dump` (requires DB access)  
✅ **Migration history** reviewed - 175 migration files exist

---

## 1. Minimal Migration Plan (Columns & Foreign Keys)

**File:** `migrations/plan_20251116.sql`

### A. Add Columns to Existing Tables

| Table | Columns to Add | Type | Justification |
|-------|---------------|------|---------------|
| `practice_rooms` | `description` | TEXT NULL | Used in RoomsManagerTable.tsx:131 |
| | `color` | TEXT NULL | Used in RoomsManagerTable.tsx:137-139 for calendar display |
| | `capacity` | INT DEFAULT 1 | Used in RoomsManagerTable.tsx:142 for concurrent appointments |
| | `active` | BOOLEAN DEFAULT true | Used in RoomsManagerTable.tsx:144-145 for status filtering |
| `amazon_tracking_api_calls` | `order_line_id` | UUID NULL FK | Used in TrackingApiUsageMonitor.tsx:39, links API call to order |

**Note:** `practice_subscriptions.rep_commission_percentage` already exists in schema (confirmed in types.ts:2756)

### B. Fix Foreign Keys

**Table:** `rep_subscription_commissions`

**Current Issue:**  
Code uses incorrect relation syntax in query:
```typescript
// Line 53 in SubscriptionCommissionManager.tsx
profiles!practice_id(id, full_name, email)  // ❌ WRONG
```

**Root Cause:**  
Table has column `rep_id` (not `practice_id`). Query syntax is incorrect.

**Migration Actions:**
1. Add FK: `rep_id → profiles(id)` (if missing)
2. Add FK: `subscription_id → practice_subscriptions(id)` (if missing)

**Code Fix Required** (not in migration):
```typescript
// Should be:
profiles!rep_id(id, full_name, email)  // ✅ CORRECT
```

---

## 2. Missing Tables - DDL Drafts (Not Yet Created)

### A. `appointment_service_types`

**File:** `ddl_drafts/missing_appointment_service_types.sql`

**Purpose:** Define service types with typical durations for calendar scheduling

**Evidence:**
- `CompleteAppointmentDialog.tsx:88` - SELECT query
- `CreateAppointmentDialog.tsx:143` - SELECT query
- `RescheduleAppointmentDialog.tsx:67` - SELECT query

**Inferred Schema:**
```sql
CREATE TABLE appointment_service_types (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  typical_duration_minutes INT DEFAULT 30,
  active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Code Usage:** Lines 622-635 in CreateAppointmentDialog.tsx show dropdown using `id`, `name`, `typical_duration_minutes`

---

### B. `patient_messages`

**File:** `ddl_drafts/missing_patient_messages.sql`

**Purpose:** Messages between patients and practice staff (with threading)

**Evidence:** 43 matches across 10 files:
- `MessagesAndChatWidget.tsx:28`
- `PatientMessagesTab.tsx:53+` (6 queries)
- `PatientMessages.tsx:48+` (3 queries)
- `InternalChat.tsx:477-707` (8 queries)

**Inferred Schema:**
```sql
CREATE TABLE patient_messages (
  id UUID PRIMARY KEY,
  practice_id UUID → profiles(id),
  patient_id UUID → patient_accounts(id),
  parent_message_id UUID → patient_messages(id),  -- Threading
  subject TEXT,
  body TEXT NOT NULL,
  sender_type TEXT CHECK IN ('patient', 'practice'),
  read_at TIMESTAMPTZ,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID → profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Key Relations:** 
- `patient_accounts!patient_messages_patient_id_fkey` (InternalChat.tsx:480)
- `profiles!patient_messages_practice_id_fkey` (InternalChat.tsx:481)

---

### C. `internal_messages`

**File:** `ddl_drafts/missing_internal_messages.sql`

**Purpose:** Internal practice team communication (task management)

**Evidence:** 20 matches across 4 files:
- `MessagesAndChatWidget.tsx:86`
- `TabbedCommunicationsWidget.tsx:89+`
- `CreateInternalMessageDialog.tsx:126+` (insert operation)
- `InternalChat.tsx:96-455` (8 queries)

**Inferred Schema:**
```sql
CREATE TABLE internal_messages (
  id UUID PRIMARY KEY,
  practice_id UUID → profiles(id),
  created_by UUID → profiles(id),
  patient_id UUID → patient_accounts(id),  -- Optional context link
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  message_type TEXT CHECK IN ('task', 'question', 'fyi', 'urgent'),
  priority TEXT CHECK IN ('low', 'normal', 'high', 'urgent'),
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID → profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Key Relations:**
- `patient_accounts!internal_messages_patient_id_fkey` (InternalChat.tsx:99)
- `internal_message_recipients` (child table)

---

### D. `internal_message_recipients`

**File:** `ddl_drafts/missing_internal_message_recipients.sql`

**Purpose:** Track recipients and read status for internal messages

**Evidence:**
- `InternalChat.tsx:100-104` (in SELECT join)
- `CreateInternalMessageDialog.tsx:172-174` (insert operation)

**Inferred Schema:**
```sql
CREATE TABLE internal_message_recipients (
  id UUID PRIMARY KEY,
  message_id UUID → internal_messages(id),
  recipient_id UUID → profiles(id),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, recipient_id)
);
```

**Code Evidence:** Line 167-174 in CreateInternalMessageDialog.tsx shows bulk insert of recipients

---

### E. `message_threads`

**File:** `ddl_drafts/missing_message_threads.sql`

**Purpose:** Organize messages into threads (support tickets, order issues)

**Evidence:** 15 matches across 3 files:
- `RecentActivityWidget.tsx:64-142` (4 queries)
- `MessagesView.tsx:155-630` (9 queries)
- `StaffDiagnostics.tsx:52` (count query)

**Inferred Schema:**
```sql
CREATE TABLE message_threads (
  id UUID PRIMARY KEY,
  subject TEXT NOT NULL,
  thread_type TEXT CHECK IN ('support', 'order_issue', 'general'),
  created_by UUID → profiles(id),
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID → profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Key Relations:**
- `thread_participants` (join table, not yet drafted)
- Self-joins via `thread_participants!inner` (MessagesView.tsx:236)

---

## 3. Additional Column Mismatches (Discovered but Not Addressed)

### Items NOT in Plan (List Only):

1. **`rep_payment_batches`**
   - Code expects `batch_number` column (ToplinePaymentManager.tsx:178)
   - Table may not exist or column is missing

2. **`thread_participants`** (implied by `message_threads` queries)
   - Not yet drafted - would need:
     - `thread_id UUID → message_threads(id)`
     - `user_id UUID → profiles(id)`
     - Unique constraint on (thread_id, user_id)

3. **Foreign Keys on `patient_appointments`**
   - Code expects `room_id → practice_rooms(id)`
   - May already exist (check schema)

---

## 4. Code Fixes Required (Outside Migration Scope)

### ❌ **Incorrect Query Syntax**

**File:** `src/components/admin/SubscriptionCommissionManager.tsx`

**Line 53:**
```typescript
// Current (WRONG):
profiles!practice_id(id, full_name, email)

// Should be (CORRECT):
profiles!rep_id(id, full_name, email)
```

**Reason:** Table column is `rep_id`, not `practice_id`. Migration adds FK, but code must also change.

---

## 5. Approval Checklist

Before executing `migrations/plan_20251116.sql`:

- [ ] Review all column additions in Section 1A
- [ ] Confirm FK logic for `rep_subscription_commissions` (Section 1B)
- [ ] Decide which missing tables to create (Section 2)
- [ ] Update code query syntax for `rep_subscription_commissions` (Section 4)
- [ ] Test migration on staging/dev environment
- [ ] Backup production database

**After Approval:**
1. Execute `migrations/plan_20251116.sql` (minimal changes only)
2. Review DDL drafts in `ddl_drafts/` folder
3. Create missing tables one-by-one with RLS policies
4. Fix TypeScript query syntax
5. Re-run type generation: `supabase gen types typescript`

---

## 6. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Breaking existing queries | 🟡 Medium | Add columns as NULL, don't drop anything |
| FK constraint violations | 🟢 Low | Use `ON DELETE SET NULL/CASCADE` appropriately |
| RLS policy gaps | 🔴 High | DDL drafts include basic RLS - **REVIEW CAREFULLY** |
| Data migration needed | 🟢 Low | No data backfill required for new columns |
| Code/schema mismatch | 🟡 Medium | Fix `rep_subscription_commissions` query syntax in code |

---

## Next Steps

1. **Review this plan** - confirm all changes align with business logic
2. **Approve Section 1** - execute `migrations/plan_20251116.sql`
3. **Review DDL drafts** - decide which tables to create in what order
4. **Update code** - fix incorrect query syntax (Section 4)
5. **Test incrementally** - create one table, test, repeat

**Do NOT proceed without explicit approval.**
