

# Add Pro Cart & Pro Orders as Separate Sidebar Nav Items

## What

Currently, the "Professional Products" sidebar section only has one item: "Pro Products". The cart is a slide-out sheet and order history is a tab within the same page. The user wants **"Pro Cart"** and **"Pro Orders"** as separate navigation items under the Professional Products section.

## Changes

### 1. Create `src/pages/ProCart.tsx`
- Dedicated full-page cart view showing all pro cart items with quantity controls, remove buttons, subtotal/shipping/total summary, and "Submit Order" button
- Reuses existing hooks: `useProCart`, `useUpdateProCartItem`, `useRemoveProCartItem`, `useClearProCart`, `useCreateProOrder`
- Contains the same order submission logic currently in `ProProducts.tsx` (PDF generation, email, clear cart)
- Responsive layout matching the app's design patterns

### 2. Create `src/pages/ProOrders.tsx`
- Dedicated full-page order history view
- Extracts the order history table currently in the "Order History" tab of `ProProducts.tsx`
- Shows date, items count, total, contact name — same columns
- Reuses `useProOrders` hook

### 3. Update `src/pages/ProProducts.tsx`
- Remove the "Order History" tab (moved to its own page)
- Remove the order submission logic (moved to ProCart page)
- Remove cart sheet component and cart-related imports
- Keep only: product grid with "Add to Cart" buttons
- Cart icon button in header navigates to `/pro-cart` instead of opening sheet

### 4. Update `src/config/menus.ts`
- Add two new items under every "Professional Products" section (4 role menus):
  - `{ label: "Pro Cart", href: "/pro-cart", icon: ShoppingCart }`
  - `{ label: "Pro Orders", href: "/pro-orders", icon: FileText }`

### 5. Update `src/App.tsx`
- Add routes: `/pro-cart` → `ProCart`, `/pro-orders` → `ProOrders`
- Lazy import both new pages

### 6. Remove `ProCartSheet.tsx`
- No longer needed since cart is now a full page

## Technical Notes
- The `ShoppingCart` and `FileText` icons are already imported in `menus.ts`
- All data hooks (`useProCart`, `useProOrders`, etc.) remain unchanged
- Zero impact on RX products, billing, or any other system

