#!/bin/bash
# Script to test patient tables merge migration locally
# This will apply the merge migration to your connected Supabase project

set -e

echo "🚀 Testing Patient Tables Merge Migration"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "supabase/migrations/20251031153732_merge_patient_accounts_and_patients.sql" ]; then
    echo "❌ Error: Migration file not found. Are you in the project root?"
    exit 1
fi

# Check if patient_accounts table exists
echo "📊 Checking current database state..."
PATIENT_TABLES=$(supabase db execute "
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND (table_name LIKE '%patient%') 
  ORDER BY table_name;
" --output json 2>&1 || echo "[]")

echo "Current patient-related tables:"
echo "$PATIENT_TABLES"
echo ""

# Check if patients table exists
echo "🔍 Checking if 'patients' table exists..."
PATIENTS_EXISTS=$(supabase db execute "
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'patients'
  );
" --output json 2>&1 || echo "false")

echo "Patients table exists: $PATIENTS_EXISTS"
echo ""

# Check if patient_accounts table exists  
echo "🔍 Checking if 'patient_accounts' table exists..."
PATIENT_ACCOUNTS_EXISTS=$(supabase db execute "
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'patient_accounts'
  );
" --output json 2>&1 || echo "false")

echo "Patient_accounts table exists: $PATIENT_ACCOUNTS_EXISTS"
echo ""

echo "📝 Next steps:"
echo "1. If tables don't exist, you'll need to apply base migrations first"
echo "2. If tables exist, run the merge migration"
echo ""
echo "To apply the merge migration manually, run:"
echo "  supabase migration up"
echo ""
echo "Or apply directly:"
echo "  supabase db execute --file supabase/migrations/20251031153732_merge_patient_accounts_and_patients.sql"

