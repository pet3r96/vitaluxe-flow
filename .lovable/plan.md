

# Add `/signup` Direct Route

## What This Does
Creates a `/signup` URL (e.g., `https://app.vitaluxeservices.com/signup`) that takes users directly to the signup form, skipping the login view.

## How It Works

### 1. Update `Auth.tsx` to support a `mode` search param
- Check for `?mode=signup` or if the current path is `/signup`
- If detected, initialize `isLogin` to `false` instead of `true`

### 2. Add `/signup` route in `App.tsx`
- Add a new public route that renders the same `Auth` component
- The Auth component will detect the `/signup` path and show the signup form

## Technical Details

**File: `src/pages/Auth.tsx`** (line 34)
- Change the `isLogin` initialization from always `true` to checking `location.pathname` for `/signup` or a `mode=signup` search param
- Use `useLocation()` to read the current path

**File: `src/App.tsx`** (after line 206)
- Add: `<Route path="/signup" element={<Auth />} />`

This is a minimal 2-file change. Users visiting `/signup` go straight to the registration form. Users visiting `/auth` still see the login form by default.

