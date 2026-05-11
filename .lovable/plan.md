# Monetization, Profit & Commission Structure

This is a read-only map of how money moves through the platform today. No code changes.

---

## 1. Revenue streams (where money comes in)

| Stream | Who pays | Amount | Charged via |
|---|---|---|---|
| **Product orders (non-Rx)** | Practice / MedSpa | Retail price = base cost × ~1.55 (universal 55% markup) + shipping + merchant fee | Authorize.Net |
| **Product orders (Rx, e.g. testosterone, injectables)** | Practice on behalf of patient | Same retail pricing, but requires prescription | Authorize.Net |
| **VitaLuxePro subscription** | Practice | $149.99 / month (14-day free trial) | Authorize.Net recurring (`process-subscription-payment`) |
| **Pro peptides orders** | Practice | Separate Pro catalog pricing | Independent pipeline (NOT through Authorize.Net per memory) |
| **Shipping fees** | Practice | Per-pharmacy tier rates, grouped per pharmacy in cart | Pass-through on order |
| **Merchant processing fee** | Practice | ~3.75% of (subtotal + shipping), configurable in `system_settings.merchant_processing_fee_percentage` | Added to order total |

Note: **Free Mode is globally ON right now** — all Pro features are unlocked for every practice regardless of subscription state. Subscription billing logic exists but is effectively bypassed.

---

## 2. Pricing tiers on every product variant

Stored on `product_variants`:
- `base_price` — our cost from the pharmacy (VIOS, etc.)
- `retail_price` — what the practice pays (default = base × 1.55)
- (Legacy `topline_price` / `downline_price` columns still referenced in `admin-recompute-profits` for profit calc)

Helpers: `src/lib/variantPricing.ts` (`getRetailPrice`, `getBasePrice`).

---

## 3. Profit & commission by role

### Super Admin / Admin (platform / Vitaluxe Services)
- **Earns:** Everything between `base_price` and `retail_price` on every non-Rx product order, minus what's paid out to reps.
- **Earns:** 100% of subscription revenue ($149.99/mo) minus rep commission share.
- **Earns:** Merchant fee (cost recovery for Authorize.Net processing).
- **Does NOT earn extra on Rx items** — practice still pays retail, but no rep commissions are paid out so admin keeps the full margin.
- Tools: `AdminProfitReports`, `SubscriptionManagement`, `PriceOverrideManager`, `MerchantFeeSettings`, `ToplinePaymentManager`.

### Topline Rep
- **Earns on product orders** (non-Rx only): `(topline_price − base_price) × quantity` for every order from a practice where `profiles.linked_topline_id = topline_user_id`.
- **Earns on subscriptions**: default **20%** of each monthly subscription payment from their linked practices (`rep_commission_percentage` per-subscription, configurable). Only paid AFTER trial ends.
- **Does NOT earn on Rx items** (memory rule: no commissions on prescription products).
- Stored in: `order_profits` (`topline_profit`), `rep_subscription_commissions`.
- Tools: `RepProfitReports`, `RepDashboard`, `RepSubscriptionReferrals`.

### Downline Rep
- **Earns on product orders**: `(downline_price − base_price) × quantity` for orders from practices the downline personally signed up (`profiles.signed_up_by_rep_id = downline_user_id`).
- Sees only practices THEY signed up — not their topline's full book.
- **No subscription commission** by default in current code (only topline gets the 20%).
- **No Rx commission**.
- Stored in: `order_profits` (`downline_profit`).

### Practice (MedSpa / clinic owner)
- **Pays retail** on all products + shipping + merchant fee.
- **Pays $149.99/mo** for Pro (currently waived by global Free Mode).
- **Does not earn** anything from the platform; sells to patients off-platform at their own markup.

### Provider / Practice Staff
- No monetization role. They place orders on behalf of the practice; all charges hit the practice account.

### Patient
- Does not pay the platform directly. Practice charges them externally. Patient-facing flows (medical vault, intake, messages) are free.

### Pharmacy (VIOS, etc.)
- Receives fulfillment data, gets paid per their wholesale agreement (the `base_price`). Not a commissioned party in-app.

---

## 4. How commissions are computed (the engines)

```text
Order placed (paid)
   │
   ▼
admin-recompute-profits  ──►  order_profits table
   • Looks up practice → linked_topline_id → reps row
   • Looks up downline assigned to that topline (if any)
   • For each non-Rx line: topline_profit += (topline_price - base_price) * qty
                           downline_profit += (downline_price - base_price) * qty
   • Refreshes rep_productivity_summary materialized view

Subscription payment succeeds
   │
   ▼
calculate-rep-commissions  ──►  rep_subscription_commissions
   • Skips if subscription.status === 'trial'
   • commission = payment.amount * (rep_commission_percentage / 100)  [default 20%]
   • Records as payment_status='pending' until admin pays out
```

Payouts to reps are tracked manually by admin via `ToplinePaymentManager` / `SubscriptionCommissionManager` (status flips pending → paid).

---

## 5. Key business rules (already enforced)

1. **Universal 55% retail markup** on base price, with per-product override possible.
2. **No commissions on Rx products** — testosterone and all injectables require Rx and pay zero commission to either tier.
3. **Topline gets subscription commission, downline does not.**
4. **Downline only sees practices they personally signed up**, even though their topline gets credit too.
5. **Trial period blocks subscription commissions** until the practice converts to active.
6. **Free Mode global override** currently makes every practice "active Pro" without billing.
7. **Merchant fee** is configurable platform-wide via `system_settings`.
8. **Per-pharmacy shipping** — when a cart spans multiple pharmacies, each pharmacy's shipping tier is charged separately.

---

## 6. Where to look in code

| Concern | File |
|---|---|
| Markup / pricing helpers | `src/lib/variantPricing.ts`, `src/lib/pricing.ts` |
| Merchant fee | `src/hooks/useMerchantFee.ts`, `system_settings` table |
| Order profit recompute | `supabase/functions/admin-recompute-profits/index.ts` |
| Subscription commission | `supabase/functions/calculate-rep-commissions/index.ts`, `process-subscription-payment` |
| Backfill old commissions | `supabase/functions/backfill-subscription-commissions/index.ts` |
| Rep dashboard math | `supabase/functions/get-rep-dashboard-stats/index.ts` |
| Admin views | `AdminProfitReports`, `SubscriptionManagement`, `ToplinePaymentManager`, `PriceOverrideManager` |
| Rep views | `RepProfitReports`, `RepDashboard`, `RepSubscriptionReferrals`, `DownlinePerformanceView` |

---

## 7. Net effect (one-line summary per role)

- **Admin:** keeps platform margin + subscription revenue − rep payouts − processing costs.
- **Topline:** product margin slice on every non-Rx order from linked practices + 20% of their practices' subscription fees.
- **Downline:** product margin slice on non-Rx orders from practices they signed up. No subscription cut.
- **Practice:** pays retail + shipping + merchant fee + (eventually) $149.99/mo.
- **Provider/Staff/Patient/Pharmacy:** no commission/profit role in-app.

This plan is informational only — approving it will not change any code.
