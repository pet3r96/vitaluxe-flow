

# Welcome Tour Module -- First-Login Onboarding Experience

## Summary
Build a multi-step welcome tour dialog that appears on first login for doctor/staff roles, showcasing all portal features. The tour is tracked in the database so it only shows once. Users can skip at any time. A "Replay Tutorial" option is added to the Profile/Settings page for later access.

## What Users Will See

### Step-by-step Welcome Tour (Modal Dialog)
A full-screen or large modal with multiple slides/steps:

**Step 1 -- "Welcome to Vitaluxe!"**
Overview of what's included in their portal:
- Full Product Catalog and Ordering capabilities
- Patient Appointment Booking -- Automated scheduling with SMS reminders
- Secure Patient Messaging -- HIPAA-compliant two-way communication
- Digital EMR and Charting -- Complete patient medical vault system
- Practice Analytics Dashboard -- Revenue tracking and patient insights
- Automated SMS Reminders -- Reduce no-shows with smart notifications
- Add Staff Members and your providers
- Priority support
- Much more...

**Step 2 -- "Get Started: Add a Licensed Provider"**
Explains that to start ordering, they need to go to User Management and add a licensed provider. Includes a direct link/button to the Providers page.

**Step 3 -- "Add Your First Patient"**
Explains that they need to add a patient before they can place orders. Includes a link to the Patients page.

**Step 4 -- "Your Portal Pages"**
A quick overview of each main page and what they can do:
- Dashboard -- Overview of your practice at a glance
- Products -- Browse and order from the full catalog
- Orders -- Track and manage all orders
- Patients -- Manage patient records and medical vaults
- Providers/Staff -- Add licensed providers and staff members
- Messages -- HIPAA-compliant communication
- Calendar -- Appointment scheduling with SMS reminders
- Documents -- Document center for your practice
- Reports -- Analytics and revenue insights

**Step 5 -- "You're All Set!"**
Final step with a "Get Started" button that closes the tour.

Each step has: Back / Next / Skip buttons. Skip closes immediately.

### Profile Page Addition
A "Replay Welcome Tour" button added to the Profile page so users can rewatch the tutorial anytime.

## Technical Approach

### Database Change
Add a `has_seen_welcome_tour` column to the `profiles` table (boolean, default `false`). This is the simplest approach since profiles already exist for every user and is queried on login.

### New Files
1. **`src/components/onboarding/WelcomeTourDialog.tsx`** -- The multi-step dialog component with all tour content
2. **`src/components/onboarding/WelcomeTourContent.tsx`** -- Individual step content components (features list, provider setup, patient setup, pages overview, completion)
3. **`src/hooks/useWelcomeTour.ts`** -- Hook to check `has_seen_welcome_tour` from profiles, show/dismiss logic, and mark as seen in DB

### Modified Files
1. **`src/App.tsx`** -- Add `<WelcomeTourDialog />` as a global component (similar to `GlobalIntakeDialog`)
2. **`src/pages/Profile.tsx`** -- Add "Replay Welcome Tour" button

### Flow Logic
1. After login, password change, terms acceptance, and 2FA are all complete
2. The `WelcomeTourDialog` component checks if `effectiveRole` is `doctor` or `staff`
3. Queries `profiles.has_seen_welcome_tour` for the user
4. If `false`, shows the multi-step tour dialog
5. On completion or skip, updates `has_seen_welcome_tour = true` in the profiles table
6. The "Replay Tutorial" button on Profile temporarily sets the state to show the dialog again (without resetting the DB flag)

### Why This Approach
- Uses the existing `profiles` table (no new tables needed)
- Single DB column tracks the state
- Fully client-side dialog rendering (no edge functions needed)
- Skippable at any step
- Replayable from Profile page
- Only targets doctor/staff roles (patients have their own intake flow)

