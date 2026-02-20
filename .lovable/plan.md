

# Audit: Remove Subscription Gate from Staff Page

## Problem
The `/staff` route is wrapped in BOTH `SubscriptionProtectedRoute` AND `ProGate`, which means practices without a subscription cannot even view or manage their staff. This contradicts the fix we just made to allow adding staff without a subscription.

## What should be Pro-only (correct as-is)
These are premium features that make sense behind the subscription gate:
- `/practice/patient-inbox` -- Patient messaging portal
- `/practice-calendar` -- Appointment scheduling/calendar
- `/document-center` -- Digital EMR/document management
- `/practice-reporting` -- Practice analytics and reports
- `/internal-chat` -- Internal team chat
- "Grant Portal Access" button in PatientsDataTable -- Patient portal invitations

## What should be FREE (needs fixing)
- **`/staff` route** -- Staff management is a core operational need, not a premium feature. Practices must be able to add and manage staff regardless of subscription status.

## Fix (1 file)

### `src/App.tsx` (lines 270-277)
Remove `SubscriptionProtectedRoute` and `ProGate` wrappers from the `/staff` route.

**Before:**
```tsx
<Route
  path="/staff"
  element={
    <SubscriptionProtectedRoute>
      <ProGate>
        <Staff />
      </ProGate>
    </SubscriptionProtectedRoute>
  }
/>
```

**After:**
```tsx
<Route path="/staff" element={<Staff />} />
```

## Summary of subscription model after this fix

| Feature | Subscription Required? |
|---|---|
| Providers (view, add) | No |
| Staff (view, add) | No |
| Patients (view, add) | No |
| Products, Cart, Checkout, Orders | No |
| Pharmacies | No |
| Patient Inbox | Yes (Pro) |
| Practice Calendar | Yes (Pro) |
| Document Center | Yes (Pro) |
| Practice Reporting | Yes (Pro) |
| Internal Chat | Yes (Pro) |
| Grant Patient Portal Access | Yes (Pro) |

No other files need changes. The inline subscription checks in `AddProviderDialog` and `AddStaffDialog` were already removed in the previous fix.

