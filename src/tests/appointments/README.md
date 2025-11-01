# Appointment Testing Suite

## Overview
This directory contains comprehensive tests for the appointment booking, cancellation, and management system.

## Test Files

### 1. `patient-cancellation.test.tsx`
Tests patient-initiated appointment cancellation flow.

**Scenarios Covered:**
- Display cancel button for upcoming appointments
- Show confirmation dialog on cancel click
- Call `cancel-appointment` edge function when confirmed
- Optimistic UI update (remove appointment immediately)
- Error handling for failed cancellations
- 12-hour time format display verification
- Practice address display for in-person appointments
- Hide address for virtual appointments

**Key Assertions:**
- ✅ Cancel button appears only for upcoming appointments
- ✅ Confirmation dialog displays proper message
- ✅ Edge function called with correct `appointmentId`
- ✅ Appointment removed from list within <500ms (optimistic update)
- ✅ Toast notification shown on success/error
- ✅ Times display as "h:mm a" (e.g., "2:30 PM"), never "HH:mm:ss"
- ✅ Address shows: "333 South Miami Avenue, Miami, FL 33130"

### 2. `practice-cancellation.test.tsx`
Tests practice/provider-initiated appointment cancellation flow.

**Scenarios Covered:**
- Display appointment details in 12-hour format
- Show status dropdown with "Cancelled" option
- Update appointment status to cancelled via dropdown
- Display patient information correctly
- Handle late night appointments (11:00 PM format)
- Handle morning appointments (9:00 AM format)
- Invalidate calendar queries after status change

**Key Assertions:**
- ✅ Status dropdown contains "Cancelled" option
- ✅ Selecting "Cancelled" updates `patient_appointments` table
- ✅ Time displays use 12-hour format (e.g., "11:00 PM", not "23:00")
- ✅ Calendar queries invalidated after status change
- ✅ Patient information (name, phone, email) displayed correctly

### 3. `time-format.test.ts`
Pure unit tests for time formatting consistency.

**Scenarios Covered:**
- Morning times with AM (9:00 AM)
- Afternoon times with PM (2:30 PM)
- Late night times with PM (11:00 PM)
- Noon (12:00 PM)
- Midnight (12:00 AM)
- No seconds in time display
- Time range formatting (2:30 PM - 3:00 PM)
- Timezone conversion handling
- No time drift (maintains exact minute values)

**Key Assertions:**
- ✅ Format pattern: `^\d{1,2}:\d{2} [AP]M$` (e.g., "2:30 PM")
- ❌ Never 24-hour format (e.g., "14:30")
- ❌ Never includes seconds (e.g., "14:30:00")
- ❌ Never has leading zeros (e.g., "09:00" → should be "9:00 AM")
- ✅ Consistent across all `date-fns` format patterns

### 4. `edge-functions/cancel-appointment.test.ts`
Backend logic tests for the `cancel-appointment` edge function.

**Scenarios Covered:**
- Successful cancellation by appointment owner
- Idempotent cancellation (already cancelled)
- Appointment not found (already deleted)
- Reject cancellation for non-owned appointments
- Cancellation during admin impersonation
- Correct timestamp setting (cancelled_at, updated_at)
- No infinite recursion in RLS policies
- Handle missing patient_account error
- Require authentication

**Key Assertions:**
- ✅ Only patient who owns appointment can cancel
- ✅ Returns success if already cancelled (idempotent)
- ✅ Sets `cancelled_at` and `updated_at` timestamps
- ✅ Supports admin impersonation (effectiveUserId)
- ✅ No infinite recursion from RLS policy checks
- ✅ Throws error if patient_account not found
- ✅ Requires authenticated user

## Running Tests

### Run All Appointment Tests
\`\`\`bash
npm test src/tests/appointments
\`\`\`

### Run Individual Test Files
\`\`\`bash
# Patient cancellation tests
npm test src/tests/appointments/patient-cancellation.test.tsx

# Practice cancellation tests
npm test src/tests/appointments/practice-cancellation.test.tsx

# Time format tests
npm test src/tests/appointments/time-format.test.ts

# Edge function tests
npm test src/tests/edge-functions/cancel-appointment.test.ts
\`\`\`

### Run Tests in Watch Mode
\`\`\`bash
npm test -- --watch
\`\`\`

### Run Tests with Coverage
\`\`\`bash
npm test -- --coverage
\`\`\`

## Test Coverage Goals

- **Unit Tests**: Pure logic functions (time formatting, data transformations)
- **Integration Tests**: Component interactions with Supabase client
- **Edge Function Tests**: Backend logic and RLS policy verification
- **E2E Tests** (Future): Full user flows across multiple pages

## Expected Behavior Summary

### Time Format Requirements
- **Display Format**: 12-hour with AM/PM (e.g., "2:30 PM")
- **Never 24-hour**: No "14:30" or "23:00"
- **No Seconds**: Never "14:30:00"
- **No Leading Zeros**: "9:00 AM", not "09:00 AM"

### Cancellation Flow Requirements
- **Patient Side**:
  1. Click "Cancel" button on upcoming appointment
  2. Confirm in AlertDialog
  3. Call `cancel-appointment` edge function
  4. Optimistic UI update (<500ms)
  5. Toast notification
  6. Invalidate queries to sync with backend

- **Practice Side**:
  1. Open appointment details dialog
  2. Change status dropdown to "Cancelled"
  3. Update `patient_appointments` table directly
  4. Invalidate calendar queries
  5. Toast notification
  6. Remove from calendar view

### RLS Policy Requirements
- **No Infinite Recursion**: Fixed policy for `provider_documents` table
- **Patient Ownership**: Only owner can cancel their appointment
- **Impersonation Support**: Admin can cancel as impersonated user
- **Idempotency**: Cancelling already-cancelled appointment returns success

## Known Issues (Fixed)

1. ✅ **Time Format**: Previously showed "HH:MM:SS" or 24-hour format
   - **Fix**: Updated to use `format(date, 'h:mm a')` everywhere

2. ✅ **Infinite Recursion**: RLS policy on `provider_documents` caused recursion
   - **Fix**: Simplified policy to avoid `can_act_for_practice` circular dependency

3. ✅ **Address Display**: Practice address wasn't showing correctly
   - **Fix**: Verified database has correct address: "333 South Miami Avenue, Miami, FL 33130"

4. ✅ **Optimistic Updates**: Slow UI updates after cancellation
   - **Fix**: Implemented optimistic cache updates with `queryClient.setQueryData`

## Future Test Additions

- [ ] Timezone edge cases (DST transitions, international timezones)
- [ ] Concurrent cancellation attempts (race conditions)
- [ ] Network failure during cancellation
- [ ] Cancellation during appointment (what if appointment is in progress?)
- [ ] Bulk cancellation operations
- [ ] Cancellation notifications (email/SMS)
- [ ] Calendar sync after cancellation (ics file removal)
