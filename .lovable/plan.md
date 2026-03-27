

# Professional Use Products — Revised Plan (Admin CRUD + Cart Experience)

## What Changed From Previous Plan

1. **Admin manages products** — No seed data. New admin page to add/edit/delete professional products with pricing.
2. **Cart experience** — Users browse a product grid, click "Add to Cart" per product (with quantity), view a separate pro cart (slide-out sheet like existing CartSheet), then submit from the cart.

## Architecture (Still Fully Isolated)

```text
EXISTING (untouched)              NEW (isolated)
─────────────────────             ──────────────
products table                    pro_products table
carts / cart_lines                pro_cart_items table
orders / order_lines              pro_orders table
Authorize.Net checkout            PDF generation + email
/products, /cart, /checkout       /pro-products, admin /pro-products-admin
```

## Database (3 new tables, 1 migration)

### `pro_products`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text NOT NULL | e.g. "BPC 157 10mg" |
| price | numeric NOT NULL | practice price |
| description | text | optional |
| active | boolean | default true |
| sort_order | int | display ordering |
| created_at / updated_at | timestamptz | |

RLS: SELECT for authenticated. INSERT/UPDATE/DELETE for admin only.

### `pro_cart_items`
Persistent cart so users can come back to it (mirrors existing cart pattern).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid | who added it |
| practice_id | uuid | which practice |
| pro_product_id | uuid FK → pro_products | |
| quantity | int | default 1 |
| created_at | timestamptz | |

RLS: Users can CRUD their own items.

### `pro_orders`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid | |
| practice_id | uuid | |
| contact_name | text | |
| contact_email | text | |
| contact_phone | text | |
| ship_to_address | jsonb | practice address |
| line_items | jsonb | snapshot of items at submission |
| subtotal | numeric | |
| shipping | numeric | default 20.00 |
| total | numeric | |
| notes | text | |
| created_at | timestamptz | |

RLS: Users SELECT/INSERT own. Admin SELECT all.

## New Files

### Admin Side
- **`src/pages/ProProductsAdmin.tsx`** — Admin-only page to list, add, edit, delete professional products. Table view with inline actions. Uses a dialog for add/edit (name, price, description, active toggle, sort order).
- **`src/hooks/useProProductsAdmin.ts`** — CRUD operations for `pro_products` table.

### User Side
- **`src/pages/ProProducts.tsx`** — Product grid (similar to existing ProductCard layout) showing all active pro products with price and "Add to Cart" button. Cart icon in top bar with item count badge. Includes "Order History" tab.
- **`src/components/pro-products/ProProductCard.tsx`** — Individual product card with name, price, quantity selector, "Add to Cart" button.
- **`src/components/pro-products/ProCartSheet.tsx`** — Slide-out cart sheet (mirrors existing CartSheet UX). Shows items, quantities (+/- controls), remove button, subtotal, $20 shipping, total, "Submit Order" button.
- **`src/hooks/useProCart.ts`** — Hook for pro_cart_items CRUD (add, update qty, remove, fetch).
- **`src/hooks/useProOrders.ts`** — Hook for fetching past pro orders.
- **`src/hooks/useProCartCount.ts`** — Badge count hook.

### Shared
- **`src/lib/proOrderPdfGenerator.ts`** — Generates PDF matching the uploaded order form template using jsPDF.

### Edge Function
- **`supabase/functions/send-pro-order/index.ts`** — Receives order data + base64 PDF, emails to VitaLuxe operations inbox.

## Modified Files

- **`src/config/menus.ts`** — Add "Pro Products" to doctor/provider/staff menus. Add "Pro Products" admin management item for admin menu.
- **`src/App.tsx`** — Add routes: `/pro-products` and `/pro-products-admin`.

## User Flow

1. Browse pro products grid → click "Add to Cart" (quantity selector)
2. Cart icon shows badge count → click to open ProCartSheet
3. Adjust quantities / remove items in cart
4. Click "Submit Order" → practice address auto-filled from profile
5. PDF generated → emailed to VitaLuxe ops → record saved to `pro_orders` → cart cleared
6. Success toast + PDF auto-downloads

## Admin Flow

1. Navigate to Pro Products management page
2. Add products with name, price, optional description
3. Edit/deactivate products as needed
4. Products appear immediately in the user-facing grid

## Zero-Touch Guarantee

No changes to: `products`, `carts`, `cart_lines`, `orders`, `order_lines`, Authorize.Net, `PatientSelectionDialog`, `PrescriptionWriterDialog`, or any existing checkout/payment logic.

