
# Disable All Subscription Gating -- Full Free Mode

## Summary
A complete audit identified **10 locations** across the codebase where subscription status affects behavior. The fix uses a single-source-of-truth approach: make `SubscriptionContext` always return `isSubscribed: true`, then handle the 2 code paths that bypass the context. All original code is preserved (unreachable) for easy re-enabling later.

## Full Audit Results

### A. Central Subscription Source (controls 90% of gating)
| # | File | What it does |
|---|------|-------------|
| 1 | `src/contexts/SubscriptionContext.tsx` | Central state -- ALL practice-side checks read from here |

### B. Components that read from the context (auto-fixed by changing #1)
| # | File | What it does |
|---|------|-------------|
| 2 | `src/components/subscription/SubscriptionProtectedRoute.tsx` | Route guard for Patient Inbox, Calendar, Documents, Reporting, Chat |
| 3 | `src/components/subscription/SubscriptionGuard.tsx` | Component-level guard (used in PracticeReporting) |
| 4 | `src/components/AppSidebar.tsx` | Lock icons on Pro menu items + "Upgrade to Pro" button in footer |
| 5 | `src/components/layout/FlyoutMenu.tsx` | Lock icons on flyout menu Pro items |
| 6 | `src/components/responsive/MobileMenuNav.tsx` | Lock icons on mobile menu Pro items |
| 7 | `src/pages/Dashboard.tsx` | "Unlock VitaLuxePro" upgrade banner + dashboard content visibility |
| 8 | `src/components/subscription/UpgradeDialog.tsx` | Upgrade dialog (never triggered if isSubscribed=true) |

### C. Independent paths (NOT controlled by SubscriptionContext)
| # | File | What it does |
|---|------|-------------|
| 9 | `src/hooks/usePatientPracticeSubscription.ts` | Patient-side: calls `practice-context` edge function to check practice subscription |
| 10 | `src/pages/AcceptTerms.tsx` | Auto-enrolls new doctors in 14-day trial via `subscribe-to-vitaluxepro` edge function |

### D. Edge Functions (no changes needed)
| Function | Why no change |
|----------|--------------|
| `practice-context` | Bypassed by #9 short-circuit |
| `subscribe-to-vitaluxepro` | Bypassed by #10 skip |
| `get-practice-subscription-status` | Bypassed by #1 short-circuit |
| `notify-patients-subscription-change` | Only fires on DB changes, harmless |

---

## Changes (3 files)

### File 1: `src/contexts/SubscriptionContext.tsx`
**What**: Add early return at the top of `refreshSubscription()` to always set `isSubscribed: true` and `status: 'active'`.

This single change automatically fixes items #2-#8 above since they all read `isSubscribed` from this context.

```
// === FREE MODE TOGGLE ===
// All Pro features are currently free. To re-enable subscription gating,
// remove this block down to the "END FREE MODE" comment.
setSubscriptionStatus({
  isSubscribed: true,
  status: 'active',
  trialEndsAt: null,
  currentPeriodEnd: null,
  trialDaysRemaining: null,
  gracePeriodEndsAt: null,
});
setLoading(false);
return;
// === END FREE MODE ===
```

All original logic remains below (unreachable but preserved).

### File 2: `src/hooks/usePatientPracticeSubscription.ts`
**What**: Add early return in `queryFn` to always return subscribed for patients. This bypasses the `practice-context` edge function call.

```
// === FREE MODE: All features free for patients ===
return {
  isSubscribed: true,
  status: "active",
  practiceId: null,
  practiceName: null,
  reason: "free_mode"
};
// === END FREE MODE ===
```

This fixes patient-side gating in PatientDocuments, PatientAppointments, AppointmentBookingDialog, and TabbedAppointmentsWidget.

### File 3: `src/pages/AcceptTerms.tsx`
**What**: Skip the auto-enrollment trial call for new doctors (lines 224-246). Since everything is free, there's no need to create a trial subscription record or call the edge function.

Wrap the block with a `false` guard:

```
// FREE MODE: Skip trial auto-enrollment (all features are free)
if (false) {
  // ... original auto-enrollment code preserved inside ...
}
```

---

## What This Achieves
- No lock icons anywhere in menus
- No "Upgrade to Pro" button in sidebar
- No upgrade banner on Dashboard
- No route blocking for Pro features
- No subscription terms/enrollment during onboarding
- Patient portal features (appointments, documents) fully accessible
- No edge function calls for subscription checks (faster page loads)

## How to Re-Enable Later
1. Remove the "FREE MODE" early-return in `SubscriptionContext.tsx`
2. Remove the "FREE MODE" early-return in `usePatientPracticeSubscription.ts`
3. Remove the `if (false)` wrapper in `AcceptTerms.tsx`

Three small reverts, all clearly marked with comments.

## What Does NOT Change
- Database tables (`practice_subscriptions`) remain intact
- Edge functions remain deployed and functional
- Subscription management admin page still works
- No route removals -- pages like `/subscribe-to-vitaluxepro` still exist but users won't be directed there
- No database migrations needed
