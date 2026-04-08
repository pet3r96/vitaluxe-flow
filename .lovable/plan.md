

# Add Shipping Destination & Address to Order Details Dialog

## Problem
The Order Details dialog shows a "Fulfillment Type" badge (Practice Order / Patient Order) but doesn't prominently display **where** the order is shipping to. The practice address only shows conditionally and the patient address is buried in individual order line details.

## Changes

### `src/components/orders/OrderDetailsDialog.tsx`

Add a clear **"Shipping Destination"** section right after the Fulfillment Type badge (around line 803), before the Payment Status section:

1. **For practice orders (`ship_to === 'practice'`)**: Show a card with a MapPin icon, "Ship to Practice" header, and the `order.practice_address`. Remove the redundant practice address block currently at line 875-880.

2. **For patient orders (`ship_to === 'patient'`)**: Show a card with a MapPin icon, "Ship to Patient" header, and the decrypted patient address from the first order line's `decryptedContactInfo`. The address data is already being fetched and decrypted — it just needs to be surfaced at the order level, not buried inside each line.

The section will use the same `p-4 bg-muted rounded-lg` styling already used for the practice address block, placed prominently right after the fulfillment type so it's immediately visible.

### No other files changed.

