

## Add Profile and Team Management to Pharmacy Sidebar

### Problem
The pharmacy sidebar menu only has 4 items: Dashboard, Orders, Shipping Management, and Messages. There is no link to the Profile page where the "Team Management" section lives. This means pharmacy owners can't access the "Add Staff Member" feature from the dashboard.

The good news: the backend is fully wired up. The `pharmacy_staff_access()` RLS function is applied to 13+ tables (orders, order_lines, shipping rates, tracking updates, etc.), so staff users **can** see and modify data once added. The `assign-user-role` edge function correctly creates staff users with the `pharmacy` role and links them via the `pharmacy_staff` table.

The only gap is **navigation** -- the pharmacy menu needs a Settings/Profile section so owners can reach the Team Management UI.

### Fix

**File: `src/config/menus.ts`**

Add a "Settings" section to the `pharmacy` menu config (matching the pattern used by other roles like `topline`):

```typescript
pharmacy: [
  {
    title: "Main Menu",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Orders", href: "/orders", icon: ShoppingCart },
      { label: "Shipping Management", href: "/shipping", icon: Truck },
      { label: "Messages", href: "/messages", icon: MessageSquare },
    ],
  },
  {
    title: "Settings",
    isParent: true,
    icon: Settings,
    items: [
      { label: "My Profile", href: "/profile", icon: UserSquare2 },
    ],
  },
],
```

This adds a collapsible "Settings" section with a "My Profile" link, which loads the `PharmacyProfileForm` that contains the Team Management section (where pharmacy owners can add/manage staff).

### What Already Works (No Changes Needed)
- **Adding staff**: `AddPharmacyStaffDialog` calls `assign-user-role` with `role: 'pharmacy_staff'`, which gets mapped to the `pharmacy` role and creates a `pharmacy_staff` record
- **RLS access**: `pharmacy_staff_access()` function grants staff access to orders, order lines, shipping rates, tracking updates, support tickets, and more
- **Staff dashboard**: Staff users get the same `pharmacy` role menus and can view/manage orders for their pharmacy
- **Team visibility**: `PharmacyTeamSection` checks both owner and staff associations to show the team management card

