

# Fix: Add Shipping Rates + Fix "No Account" Display

## Two Issues

### 1. Missing Shipping Rates
The `pharmacy_shipping_rates` table has zero rows for VIOS. The cart and shipping selector rely on this table, so no shipping options appear. We need to insert the 4 standard rates.

### 2. "No Account" Badge Is Misleading
The Pharmacy Management table shows a red "No Account" badge because VIOS has no `user_id`. This is expected -- VIOS is an API-integrated pharmacy and doesn't need a user account. The display logic should recognize API-enabled pharmacies and show "API Integrated" instead of "No Account".

---

## Changes

### Database: Insert 4 shipping rates for VIOS

Insert rows into `pharmacy_shipping_rates`:

| Speed | Rate | VIOS Service Code |
|-------|------|-------------------|
| overnight | $45.00 | 7618 (FedEx Standard Overnight) |
| 2day | $25.00 | 7608 (FedEx 2 Day) |
| priority | $15.00 | 7615 (USPS Priority) |
| first_class | $8.00 | 7615 (USPS Priority) |

These are placeholder prices you can adjust later via the "Configure Rates" button.

### Code: Fix Account Status display

**File: `src/components/pharmacies/PharmaciesDataTable.tsx`**

Update the Account Status column logic:
- If `api_enabled` is true, show a blue "API Integrated" badge (not an error)
- If `user_id` exists, show green "Active"
- Otherwise show red "No Account"

This same fix applies in two places: the table row and the mobile card view.

## Expected Result

- VIOS shows "API Integrated" instead of the alarming red "No Account"
- Cart displays all 4 shipping options with prices
- "Configure Rates" button on the Pharmacies page lets you adjust rates anytime

