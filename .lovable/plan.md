

# Fix: Cleanup Failed + Suppress Handled Signup Errors

## Two Issues Found

### Issue 1: "Cleanup failed" when deleting accounts
**Root cause:** The `performance_metrics` table has a foreign key `performance_metrics_user_id_fkey` referencing `auth.users` WITHOUT `ON DELETE CASCADE`. When the admin deletes a user account, Postgres blocks the auth user deletion because rows still exist in `performance_metrics`.

**Fix (two parts):**

A. **Database migration** -- Delete `performance_metrics` rows for the user before deleting the auth user in the cleanup edge function. Also alter the foreign key to add `ON DELETE CASCADE` so this class of bug can't recur:

```sql
ALTER TABLE performance_metrics
  DROP CONSTRAINT performance_metrics_user_id_fkey,
  ADD CONSTRAINT performance_metrics_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
```

B. **Edge function update** -- Add a step in `cleanup-test-data/index.ts` (before Step 9) to delete `performance_metrics` rows for the target user, as a safety net:

```typescript
await supabaseAdmin.from('performance_metrics').delete().eq('user_id', userId);
```

---

### Issue 2: Preview error banner on handled signup errors
**Root cause:** `authService.ts` calls `logger.error()` for expected business outcomes like duplicate emails (lines 78, 84, 142, 149). This triggers `console.error`, which the preview error boundary catches and shows the red banner.

**Fix:** Downgrade these to `logger.warn()` since they are expected/handled errors, not crashes. Also improve the duplicate email message to be clearer:

| Line | Current | Updated |
|------|---------|---------|
| 50-55 (signupUser) | "This email address is already registered..." | "This email already exists in the system. No duplicate users allowed -- please use another email or log in with your existing account." |
| 78 | `logger.error('Self-signup error', error)` | `logger.warn('Self-signup rejected', { message: msg })` |
| 84 | `logger.error('Self-signup validation error', ...)` | `logger.warn('Self-signup validation rejected', { message: data.error })` |
| 115-119 (createUserByAdmin) | "This email address is already registered in the system." | "This email already exists in the system. No duplicate users allowed -- please use another email or log in with the existing account." |
| 142 | `logger.error('Admin user creation error', error)` | `logger.warn('Admin user creation rejected', { message: msg })` |
| 149 | `logger.error('Admin user creation validation error', ...)` | `logger.warn('Admin user creation rejected', { message: data.error })` |

---

## Files Changed

| File | Change |
|------|--------|
| New database migration | Add `ON DELETE CASCADE` to `performance_metrics_user_id_fkey` |
| `supabase/functions/cleanup-test-data/index.ts` | Delete `performance_metrics` rows before auth user deletion |
| `src/lib/authService.ts` | Downgrade handled errors to `logger.warn`, improve duplicate email messages |

