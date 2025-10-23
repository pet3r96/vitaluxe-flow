# EasyPost Integration - Production Deployment Guide

## 🚀 Production Deployment Steps

### 1. Database Migration

Run the database migration to create EasyPost tables:

```bash
# Connect to your Supabase project
supabase db push

# Or if using Supabase CLI with remote project
supabase db push --project-ref qbtsfajshnrwwlfzkeog
```

**Migration File**: `supabase/migrations/20250120000000_add_easypost_integration.sql`

This will create:
- `easypost_shipments` table
- `easypost_tracking_events` table  
- New columns in `profiles`, `patients`, `pharmacies`, `order_lines`
- RLS policies for security
- API rate limiting configuration

### 2. Environment Configuration

Add the EasyPost API key to Supabase Edge Functions secrets:

**Via Supabase Dashboard:**
1. Go to Project Settings → Edge Functions → Secrets
2. Add new secret:
   - **Name**: `EASYPOST_API_KEY`
   - **Value**: `EZAKaaeb5c827c54edba8870f0ba3f41db1yT0MIMpwIMGoYPsHaEEy1g`

**Via CLI:**
```bash
supabase secrets set EASYPOST_API_KEY=EZAKaaeb5c827c54edba8870f0ba3f41db1yT0MIMpwIMGoYPsHaEEy1g
```

### 3. Deploy Edge Functions

Deploy the new EasyPost functions:

```bash
# Deploy all functions
supabase functions deploy

# Or deploy specific functions
supabase functions deploy create-easypost-shipment
supabase functions deploy get-easypost-tracking
supabase functions deploy validate-address
supabase functions deploy bulk-verify-addresses
supabase functions deploy update-shipping-info
```

### 4. Verify Deployment

Test the deployment:

```bash
# Test address verification
curl -X POST 'https://qbtsfajshnrwwlfzkeog.supabase.co/functions/v1/validate-address' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"street": "123 Main St", "city": "New York", "state": "NY", "zip": "10001"}'

# Test bulk verification
curl -X POST 'https://qbtsfajshnrwwlfzkeog.supabase.co/functions/v1/bulk-verify-addresses' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"entity_type": "all"}'
```

## 🔧 Production Configuration

### Database Tables Created

1. **easypost_shipments**
   - Stores shipment data from EasyPost
   - Links to order_lines
   - Tracks carrier, service, rates

2. **easypost_tracking_events**
   - Stores tracking event history
   - Links to order_lines
   - Tracks status changes over time

3. **Enhanced Tables**
   - `profiles`: Added `easypost_address_id`
   - `patients`: Added `easypost_address_id`
   - `pharmacies`: Added `easypost_address_id`
   - `order_lines`: Added `easypost_shipment_id`

### API Rate Limits Configured

- **easypost_address_verification**: 1000/day, 100/hour, $0.05/call
- **easypost_shipment_creation**: 100/day, 20/hour, $0.10/call
- **easypost_tracking**: 500/day, 50/hour, $0.02/call

### Security Features

- ✅ RLS policies on all new tables
- ✅ Authentication required for all functions
- ✅ CSRF protection
- ✅ Rate limiting
- ✅ Audit logging

## 🧪 Testing Production Deployment

### 1. Test Address Verification

```javascript
// Test EasyPost address verification
const { data, error } = await supabase.functions.invoke('validate-address', {
  body: {
    street: "123 Main St",
    city: "New York", 
    state: "NY",
    zip: "10001"
  }
});
```

### 2. Test Shipment Creation

```javascript
// Test shipment creation (requires authenticated user)
const { data, error } = await supabase.functions.invoke('create-easypost-shipment', {
  body: {
    order_line_id: "your-order-line-id",
    from_address: {
      street: "123 Pharmacy St",
      city: "Chicago",
      state: "IL",
      zip: "60601",
      name: "Test Pharmacy"
    },
    to_address: {
      street: "456 Patient Ave", 
      city: "Miami",
      state: "FL",
      zip: "33101",
      name: "John Doe"
    }
  }
});
```

### 3. Test Tracking

```javascript
// Test tracking retrieval
const { data, error } = await supabase.functions.invoke('get-easypost-tracking', {
  body: {
    tracking_code: "your-tracking-code"
  }
});
```

## 📊 Monitoring & Maintenance

### Key Metrics to Monitor

1. **API Usage**
   - EasyPost API call volume
   - Rate limit compliance
   - Cost tracking

2. **Address Verification**
   - Success rates
   - EasyPost vs ZIP validation usage
   - Confidence scores

3. **Shipment Performance**
   - Creation success rates
   - Tracking update frequency
   - Delivery completion rates

### Maintenance Tasks

1. **Weekly**
   - Review API usage and costs
   - Check for failed address verifications
   - Monitor tracking update frequency

2. **Monthly**
   - Analyze address verification patterns
   - Review shipment success rates
   - Update rate limits if needed

## 🚨 Troubleshooting

### Common Issues

1. **EasyPost API Key Not Working**
   - Verify key is correctly set in secrets
   - Check key permissions in EasyPost dashboard
   - Ensure key is production key, not test key

2. **Address Verification Failing**
   - Check EasyPost API status
   - Verify rate limits not exceeded
   - Review error logs in Supabase

3. **Shipment Creation Issues**
   - Verify order line exists
   - Check address data completeness
   - Ensure user has proper permissions

### Debug Commands

```bash
# Check function logs
supabase functions logs create-easypost-shipment
supabase functions logs get-easypost-tracking

# Check database status
supabase db diff

# Verify secrets
supabase secrets list
```

## ✅ Production Checklist

- [ ] Database migration applied
- [ ] EasyPost API key configured
- [ ] Edge functions deployed
- [ ] Address verification tested
- [ ] Shipment creation tested
- [ ] Tracking functionality verified
- [ ] Admin interface accessible
- [ ] Rate limits configured
- [ ] Monitoring setup
- [ ] Error handling verified

## 🎉 Deployment Complete!

Once all steps are completed, your EasyPost integration will be fully operational in production with:

- ✅ Enhanced address verification using EasyPost
- ✅ Automatic shipment creation
- ✅ Real-time tracking capabilities
- ✅ Comprehensive admin management
- ✅ Robust error handling and fallbacks
- ✅ Security and rate limiting
- ✅ Full audit logging

**The system is now production-ready! 🚀**
