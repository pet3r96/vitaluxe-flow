

# Cleanup: Legacy Routes and Dead Code

## What was found

Checking every route from the screenshots and cross-referencing with the codebase:

### Routes from your URL history dropdown

| Route | Status | Action |
|-------|--------|--------|
| `/developer` | 404 -- No route exists in App.tsx | Clean up the unused component file |
| `/products` | Valid | None needed |
| `/subscribe-to-vitaluxepro` | Valid | None needed |
| `/change-password` | Valid | None needed |
| `/auth` | Valid | None needed |
| `/accept-terms` | Valid | None needed |
| `/` | Valid | None needed |
| `/delivery-confirmation` | Valid | None needed |
| `/dashboard` | Valid | None needed |

### What to clean up

**1. Delete `src/components/DeveloperRoute.tsx`**
- This component is not imported anywhere (the import was removed in the last audit)
- Contains hardcoded email addresses
- The `/developer` route was never added to App.tsx, so visiting it shows a 404
- Safe to delete -- zero references remain

**2. Clean up legacy performance metrics data**
- The database has old tracking entries for pages that no longer exist: `VideoCallTest`, `VideoRoom`, `PharmacyApiLogs`
- These are historical metrics from deleted features -- they don't cause any errors but clutter reporting
- A one-time database cleanup query will remove them

### What is NOT being touched
- All valid routes remain unchanged
- `AdminProfitReports.tsx`, `PracticeProfitReports.tsx`, `PracticeAuditLog.tsx` -- these are sub-components used inside other pages (Reports, Security), confirmed in the previous audit. They stay.
- The `/developer` 404 entries in the browser's URL history will naturally clear over time once the route stops being visited

### Technical steps
1. Delete `src/components/DeveloperRoute.tsx`
2. Run a database migration to clean stale `performance_metrics` rows for deleted pages (`VideoCallTest`, `VideoRoom`, `PharmacyApiLogs`)

