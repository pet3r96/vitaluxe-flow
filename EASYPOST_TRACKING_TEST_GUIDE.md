# EasyPost Tracking Test Guide

## Overview
This guide provides step-by-step procedures to test EasyPost tracking functionality and verify that delivered shipments correctly update order status to "completed".

## Test Environment Setup

### Prerequisites
- EasyPost API key configured in environment
- Access to admin panel with EasyPost Shipment Manager
- Test tracking codes available

### EasyPost Test Tracking Codes
Use these test codes for consistent testing:

| Test Code | Expected Status | Description |
|-----------|----------------|-------------|
| `EZ1000000001` | `pre_transit` | Pre-shipment info sent |
| `EZ1000000002` | `in_transit` | Package in transit |
| `EZ1000000003` | `delivered` | Package delivered |
| `EZ1000000004` | `out_for_delivery` | Out for delivery |
| `EZ1000000005` | `return_to_sender` | Returned to sender |

## Test Procedures

### 1. Test Status Mapping (Critical Fix)

**Objective**: Verify that when EasyPost reports "delivered" status, the order_line status is set to "completed".

**Steps**:
1. Navigate to Admin Panel → EasyPost Shipment Manager
2. Select "Manual Entry" mode
3. Enter test code: `EZ1000000003` (delivered status)
4. Click "Test Tracking"
5. **Verify**: 
   - Status badge shows "Delivered" in UI
   - Check database: `order_lines.status` should be `'completed'`
   - Check database: `orders.status` should be `'completed'` (via trigger)

**Expected Result**: ✅ Order status = "completed" (not "delivered")

### 2. Test All Tracker API Fields

**Objective**: Verify all EasyPost Tracker API fields are captured and displayed.

**Steps**:
1. Test with code: `EZ1000000001`
2. **Verify Response Contains**:
   - ✅ `status`: Current tracking status
   - ✅ `tracking_url`: Public tracking URL
   - ✅ `events`: Array of tracking events
   - ✅ `carrier`: Carrier name (e.g., "USPS")
   - ✅ `est_delivery_date`: Estimated delivery date
   - ✅ `signed_by`: Who signed for package (if delivered)
   - ✅ `weight`: Package weight in ounces
   - ✅ `carrier_detail`: Additional carrier information

### 3. Test Tracking Events Storage

**Objective**: Verify tracking events are stored in `easypost_tracking_events` table.

**Steps**:
1. Test with any tracking code
2. Check database table: `easypost_tracking_events`
3. **Verify**:
   - Events are inserted with correct `order_line_id`
   - `easypost_tracker_id` matches tracking code
   - `status`, `message`, `description` are captured
   - `event_time` is properly formatted
   - `carrier` information is stored

### 4. Test UI Components

**Objective**: Verify UI correctly displays all tracking information.

**Steps**:
1. Navigate to Orders page
2. Find an order with tracking information
3. **Verify ShipmentTrackingCard**:
   - Status badge shows correct color/icon
   - Tracking number is displayed
   - Carrier badge is shown
   - "Track on Carrier Website" button works
   - Tracking history timeline is visible
   - Events show proper timestamps and descriptions

### 5. Test Status Badge Colors

**Objective**: Verify status badges use correct colors and icons.

**Expected Badge Colors**:
- 🟢 **Delivered**: Green badge with CheckCircle icon
- 🔵 **In Transit**: Blue badge with Truck icon  
- ⚪ **Pre Transit**: Gray badge with Package icon
- 🔴 **Unknown**: Red badge with AlertCircle icon
- 🟡 **Other**: Yellow badge with Clock icon

### 6. Test Order Status Triggers

**Objective**: Verify database triggers correctly update order status.

**Steps**:
1. Create test order with multiple order lines
2. Set one order line to "completed" status
3. **Verify**:
   - If all lines are "completed" → order status = "completed"
   - If mixed statuses → order status = "processing"
   - Database trigger `update_order_status()` works correctly

## Database Verification Queries

### Check Order Status Updates
```sql
-- Verify order status after tracking update
SELECT 
  o.id as order_id,
  o.status as order_status,
  ol.id as order_line_id,
  ol.status as line_status,
  ol.delivered_at
FROM orders o
JOIN order_lines ol ON o.id = ol.order_id
WHERE ol.tracking_number IS NOT NULL
ORDER BY ol.updated_at DESC
LIMIT 10;
```

### Check Tracking Events
```sql
-- Verify tracking events are stored
SELECT 
  ete.order_line_id,
  ete.easypost_tracker_id,
  ete.status,
  ete.message,
  ete.event_time,
  ete.carrier
FROM easypost_tracking_events ete
ORDER BY ete.created_at DESC
LIMIT 20;
```

### Check EasyPost Shipments
```sql
-- Verify EasyPost shipment data
SELECT 
  es.easypost_shipment_id,
  es.tracking_code,
  es.carrier,
  es.status,
  es.label_url,
  es.tracking_url
FROM easypost_shipments es
ORDER BY es.created_at DESC
LIMIT 10;
```

## Test Scenarios

### Scenario 1: Complete Delivery Flow
1. Create order with tracking number
2. Test tracking with "in_transit" status
3. Update tracking to "delivered" status
4. **Verify**: Order status becomes "completed"

### Scenario 2: Multiple Order Lines
1. Create order with 2 order lines
2. Set first line to "completed"
3. Set second line to "shipped"
4. **Verify**: Order status = "processing"

### Scenario 3: Error Handling
1. Test with invalid tracking code
2. **Verify**: Error message displayed, no database corruption
3. Test with network timeout
4. **Verify**: Graceful error handling

## Success Criteria

### ✅ Critical Fixes
- [ ] Delivered shipments set order_line status to "completed"
- [ ] Order status triggers work correctly
- [ ] UI displays correct status badges

### ✅ API Integration
- [ ] All Tracker API fields captured
- [ ] Tracking events stored in database
- [ ] Error handling works properly

### ✅ UI Components
- [ ] Status badges show correct colors/icons
- [ ] Tracking timeline displays properly
- [ ] External tracking links work
- [ ] Carrier information displayed

### ✅ Database
- [ ] Tracking events stored correctly
- [ ] Order status updates trigger properly
- [ ] No data corruption on errors

## Troubleshooting

### Common Issues

**Issue**: Status not updating to "completed"
- **Check**: Database trigger `update_order_status()` is active
- **Check**: Order line status is actually "completed"
- **Fix**: Verify trigger function is working

**Issue**: Tracking events not stored
- **Check**: `easypost_tracking_events` table exists
- **Check**: RLS policies allow inserts
- **Fix**: Verify database permissions

**Issue**: UI not displaying tracking
- **Check**: React Query cache is working
- **Check**: API response format matches UI expectations
- **Fix**: Verify component props and data flow

## Test Results Template

```
Test Date: ___________
Tester: ___________

✅ Status Mapping Test
- [ ] Delivered → Completed: PASS/FAIL
- [ ] UI Badge Colors: PASS/FAIL
- [ ] Database Triggers: PASS/FAIL

✅ API Integration Test  
- [ ] All Fields Captured: PASS/FAIL
- [ ] Events Stored: PASS/FAIL
- [ ] Error Handling: PASS/FAIL

✅ UI Components Test
- [ ] Tracking Card Display: PASS/FAIL
- [ ] Status Badges: PASS/FAIL
- [ ] External Links: PASS/FAIL

Overall Result: PASS/FAIL
Notes: ___________
```

## Conclusion

This test guide ensures the EasyPost tracking integration works correctly and that the critical fix (delivered → completed status mapping) is properly implemented. All tests should pass before considering the integration production-ready.
