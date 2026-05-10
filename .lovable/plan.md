# Create a new super_admin login

## What I'll do

1. Create a new auth user via the Supabase Admin API in a one-off edge function call (email pre-confirmed, no verification needed):
   - Email: `superadmin@vitaluxeservices.com`
   - Password: auto-generated 20-char strong random password (shown once in chat)
   - Name: `Super Admin`
2. Insert a matching row in `public.profiles` with `status='active'`, `active=true`, `temp_password=false`, `must_change_password=false`, and terms pre-accepted so login isn't blocked by the post-login gates.
3. Insert two rows in `public.user_roles` for this user: `admin` and `super_admin` (matching the existing super_admin pattern).
4. Verify by querying `profiles` + `user_roles`.
5. Return the credentials to you in chat. You should change the password after first login.

## Technical details

- User creation will go through the existing `create_user_with_role` DB function (10-arg signature) to stay consistent with the project's signup pipeline, called from a small admin script via the migration/insert tools. Auth user is created first using `supabase.auth.admin.createUser({ email_confirm: true })`.
- No schema changes. No new tables. No new edge functions.
- One file touched? No — this is a data-only operation (auth user + profile + roles rows). No app code changes.

## Scope
- 0 code files changed
- 1 auth user created
- 3 DB rows inserted (profiles + 2× user_roles)
