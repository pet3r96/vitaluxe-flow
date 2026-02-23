
# Show Linked Patient Name on Practice Orders in Delivery Confirmation

## What Changes
On the Delivery Confirmation page, update the practice order item list to show the linked patient name when one exists.

### Current Display
```
- Semaglutide (Qty: 1)
```

### New Display
```
- Semaglutide (Qty: 1) - for Demo Patient 1
```

## Technical Details

### File: `src/pages/DeliveryConfirmation.tsx`

**Change 1 -- Item list (lines 531-535)**

Update the practice order line items to show the linked patient name when available:

```tsx
{practiceOrders.map((line) => (
  <div key={line.id} className="text-muted-foreground">
    • {line.product?.name} (Qty: {line.quantity})
    {line.patient_name && line.patient_name !== "Practice Order" && (
      <span className="text-foreground/70"> — for {line.patient_name}</span>
    )}
  </div>
))}
```

This only shows the patient name when:
- `patient_name` exists
- `patient_name` is not the default "Practice Order" placeholder

No other files need changes.
