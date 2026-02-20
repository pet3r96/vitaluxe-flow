

# Fix: Remove Email Requirement from Add-to-Cart Flow

## Problem

The "Patient email is required" error is still showing when adding products to cart because there are explicit email validation checks in two product components that block the flow. These checks contradict the established rule that patients without email addresses should be fully eligible for ordering.

## Changes

### 1. Remove email validation from ProductsGrid.tsx (lines 693-697)

Remove the `if (!patientRecord.email)` check that blocks adding to cart.

### 2. Remove email validation from ProductsDataTable.tsx (lines 468-472)

Remove the identical `if (!patientRecord.email)` check in the table view.

Both files have the same pattern -- a validation block that returns early with an error toast if `patientRecord.email` is falsy. Removing these two blocks is all that's needed. The rest of the add-to-cart flow (address validation, shipping lookup, cart insertion) does not depend on email being present.

## Technical Summary

| File | Change |
|------|--------|
| `src/components/products/ProductsGrid.tsx` (lines 693-697) | Delete email validation block |
| `src/components/products/ProductsDataTable.tsx` (lines 468-472) | Delete email validation block |

