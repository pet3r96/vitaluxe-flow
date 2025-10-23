# 🚀 EasyPost Integration - Manual Deployment Guide

Since automated deployment requires Supabase authentication, here's the complete manual deployment process:

## 📋 Prerequisites

1. **Supabase CLI Installed** ✅ (Already installed)
2. **Supabase Project Access** - You'll need to authenticate
3. **EasyPost API Key** - Already provided: `EZAKaaeb5c827c54edba8870f0ba3f41db1yT0MIMpwIMGoYPsHaEEy1g`

## 🔧 Step-by-Step Deployment

### Step 1: Authenticate with Supabase

```bash
# Login to Supabase (opens browser for authentication)
supabase login

# Link to your project
supabase link --project-ref qbtsfajshnrwwlfzkeog
```

### Step 2: Apply Database Migration

```bash
# Apply the EasyPost migration
supabase db push
```

This will create:
- `easypost_shipments` table
- `easypost_tracking_events` table
- New columns in existing tables
- RLS policies for security
- Rate limiting configuration

### Step 3: Set EasyPost API Key

```bash
# Set the EasyPost API key as a secret
supabase secrets set EASYPOST_API_KEY=EZAKaaeb5c827c54edba8870f0ba3f41db1yT0MIMpwIMGoYPsHaEEy1g
```

### Step 4: Deploy Edge Functions

```bash
# Deploy all EasyPost functions
supabase functions deploy create-easypost-shipment
supabase functions deploy get-easypost-tracking
supabase functions deploy validate-address
supabase functions deploy bulk-verify-addresses
supabase functions deploy update-shipping-info
```

### Step 5: Verify Deployment

```bash
# Check function status
supabase functions list

# Test address verification
curl -X POST 'https://qbtsfajshnrwwlfzkeog.supabase.co/functions/v1/validate-address' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"street": "123 Main St", "city": "New York", "state": "NY", "zip": "10001"}'
```

## 🎯 Alternative: Supabase Dashboard Deployment

If CLI deployment doesn't work, you can deploy via the Supabase Dashboard:

### 1. Database Migration
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `qbtsfajshnrwwlfzkeog`
3. Go to **SQL Editor**
4. Copy and paste the contents of `supabase/migrations/20250120000000_add_easypost_integration.sql`
5. Click **Run**

### 2. Set Environment Variables
1. Go to **Project Settings** → **Edge Functions** → **Secrets**
2. Add new secret:
   - **Name**: `EASYPOST_API_KEY`
   - **Value**: `EZAKaaeb5c827c54edba8870f0ba3f41db1yT0MIMpwIMGoYPsHaEEy1g`

### 3. Deploy Edge Functions
1. Go to **Edge Functions** in the dashboard
2. For each function, upload the files:
   - `supabase/functions/create-easypost-shipment/index.ts`
   - `supabase/functions/get-easypost-tracking/index.ts`
   - `supabase/functions/validate-address/index.ts`
   - `supabase/functions/bulk-verify-addresses/index.ts`
   - `supabase/functions/update-shipping-info/index.ts`

## 📊 What Gets Deployed

### Database Changes
- ✅ New tables: `easypost_shipments`, `easypost_tracking_events`
- ✅ Enhanced existing tables with EasyPost columns
- ✅ RLS policies for security
- ✅ Rate limiting configuration

### Edge Functions
- ✅ `create-easypost-shipment` - Shipment creation
- ✅ `get-easypost-tracking` - Tracking retrieval
- ✅ `validate-address` - Enhanced address verification
- ✅ `bulk-verify-addresses` - Bulk processing
- ✅ `update-shipping-info` - Auto-shipment triggers

### UI Components
- ✅ EasyPost Shipment Manager (admin panel)
- ✅ Shipment Tracking Card (order tracking)
- ✅ Enhanced Address Verification Panel
- ✅ Improved address input with confidence scores

## 🧪 Post-Deployment Testing

### Test Address Verification
```javascript
// Test in your app
const { data, error } = await supabase.functions.invoke('validate-address', {
  body: {
    street: "123 Main St",
    city: "New York",
    state: "NY",
    zip: "10001"
  }
});
```

### Test Admin Interface
1. Go to `/admin-settings`
2. Click on "EasyPost Shipments" tab
3. Verify the EasyPost Shipment Manager loads

### Test Address Input
1. Go to any form with address input
2. Enter an address
3. Verify EasyPost verification works with confidence scores

## 🎉 Deployment Complete!

Once all steps are completed, your EasyPost integration will be fully operational with:

- ✅ Enhanced address verification using EasyPost
- ✅ Automatic shipment creation
- ✅ Real-time tracking capabilities
- ✅ Comprehensive admin management
- ✅ Robust error handling and fallbacks
- ✅ Security and rate limiting

## 🚨 Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Make sure you're logged into the correct Supabase account
   - Check project permissions

2. **Migration Failed**
   - Check if tables already exist
   - Review migration file for syntax errors

3. **Function Deployment Failed**
   - Verify all dependencies are included
   - Check function syntax

4. **API Key Not Working**
   - Verify the key is set correctly in secrets
   - Check EasyPost dashboard for key status

### Support

If you encounter issues:
1. Check Supabase logs in the dashboard
2. Verify all environment variables are set
3. Test individual functions manually
4. Review the test results in `EASYPOST_TEST_RESULTS.md`

**Your EasyPost integration is ready for deployment! 🚀**
