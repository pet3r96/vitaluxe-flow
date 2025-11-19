#!/bin/bash

# =====================================================
# PHASE 2 WEEK 5: Security Test Suite Runner
# =====================================================
# 
# This script runs the automated security test suite
# against the Lovable Cloud backend.
#
# Usage:
#   export CRON_SECRET="your-cron-secret"
#   ./test-security.sh
#
# Requirements:
#   - CRON_SECRET environment variable must be set
#   - curl must be installed
# =====================================================

SUPABASE_URL="https://qbtsfajshnrwwlfzkeog.supabase.co"

# Check if CRON_SECRET is set
if [ -z "$CRON_SECRET" ]; then
  echo "❌ ERROR: CRON_SECRET environment variable is not set"
  echo "Please set it before running this script:"
  echo "  export CRON_SECRET=\"your-cron-secret\""
  exit 1
fi

echo "🔒 Running Phase 2 Security Test Suite..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Run security tests
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST \
  "${SUPABASE_URL}/functions/v1/run-security-tests" \
  -H "x-cron-secret: ${CRON_SECRET}" \
  -H "Content-Type: application/json")

# Extract HTTP status
http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d':' -f2)
body=$(echo "$response" | sed '/HTTP_STATUS:/d')

echo "HTTP Status: $http_status"
echo ""

if [ "$http_status" = "200" ]; then
  echo "✅ Security test suite completed successfully"
  echo ""
  echo "$body" | jq '.'
else
  echo "❌ Security test suite failed"
  echo ""
  echo "$body"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Security tests complete."
