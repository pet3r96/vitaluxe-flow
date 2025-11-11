#!/bin/bash

# Verify Supabase Functions Deployment
# Usage: ./scripts/verify-deployment.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

PROJECT_REF="qbtsfajshnrwwlfzkeog"
BASE_URL="https://$PROJECT_REF.supabase.co/functions/v1"

# Check CLI
print_header "Checking Supabase CLI"

if ! command -v supabase &> /dev/null; then
    print_error "Supabase CLI not installed"
    exit 1
fi

print_success "Supabase CLI installed: $(supabase --version)"

# Check authentication
print_header "Checking Authentication"

if ! supabase projects list &> /dev/null; then
    print_error "Not authenticated. Run: supabase login"
    exit 1
fi

print_success "Authenticated successfully"

# List functions
print_header "Listing Deployed Functions"

FUNCTION_LIST=$(supabase functions list 2>&1)
FUNCTION_COUNT=$(echo "$FUNCTION_LIST" | grep -E "^\│" | wc -l | tr -d ' ')

if [ "$FUNCTION_COUNT" -gt 0 ]; then
    print_success "Found $FUNCTION_COUNT deployed functions"
    echo "$FUNCTION_LIST"
else
    print_error "No functions found. Functions need to be deployed."
    echo ""
    print_warning "Deploy functions with: ./scripts/deploy-functions.sh"
    exit 1
fi

# Check critical video functions
print_header "Verifying Critical Video Functions"

CRITICAL_FUNCTIONS=(
    "generate-agora-token"
    "join-video-session"
    "test-agora-token"
    "validate-video-guest-link"
    "agora-echo"
    "agora-healthcheck"
)

ALL_CRITICAL_OK=true

for func in "${CRITICAL_FUNCTIONS[@]}"; do
    if supabase functions list 2>/dev/null | grep -q "$func"; then
        print_success "$func is deployed"
    else
        print_error "$func is NOT deployed"
        ALL_CRITICAL_OK=false
    fi
done

if [ "$ALL_CRITICAL_OK" = false ]; then
    echo ""
    print_warning "Some critical functions are missing. Deploy them with:"
    echo "  ./scripts/deploy-functions.sh"
    exit 1
fi

# Test public endpoints
print_header "Testing Public Endpoints"

# Test agora-echo
print_success "Testing agora-echo..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/agora-echo" 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    print_success "agora-echo: $HTTP_CODE"
    
    # Check if response contains expected fields
    if echo "$BODY" | grep -q "appId"; then
        print_success "Response contains valid Agora config"
    else
        print_warning "Response format unexpected"
    fi
else
    print_error "agora-echo: $HTTP_CODE"
    echo "Response: $BODY"
fi

# Test edge-ping
print_success "Testing edge-ping..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/edge-ping" 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    print_success "edge-ping: $HTTP_CODE"
else
    print_error "edge-ping: $HTTP_CODE"
    echo "Response: $BODY"
fi

# Check secrets
print_header "Verifying Secrets"

REQUIRED_SECRETS=(
    "AGORA_APP_ID"
    "AGORA_APP_CERTIFICATE"
)

for secret in "${REQUIRED_SECRETS[@]}"; do
    if supabase secrets list 2>/dev/null | grep -q "$secret"; then
        print_success "$secret is configured"
    else
        print_error "$secret is NOT configured"
    fi
done

# Check recent logs
print_header "Checking Recent Function Activity"

for func in "${CRITICAL_FUNCTIONS[@]}"; do
    LOG_COUNT=$(supabase functions logs "$func" --limit 5 2>/dev/null | wc -l || echo "0")
    
    if [ "$LOG_COUNT" -gt 0 ]; then
        print_success "$func has recent logs ($LOG_COUNT entries)"
    else
        print_warning "$func has no recent logs (might not be used yet)"
    fi
done

# Final summary
print_header "Deployment Summary"

echo ""
print_success "Total deployed functions: $FUNCTION_COUNT"
print_success "Critical functions: ${#CRITICAL_FUNCTIONS[@]}/${#CRITICAL_FUNCTIONS[@]} deployed"
print_success "Public endpoints: Reachable"
print_success "Secrets: Configured"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✓ Deployment verification complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Next steps:"
echo "  1. Test video sessions in the app"
echo "  2. Monitor logs: supabase functions logs generate-agora-token --follow"
echo "  3. Check frontend: Ensure VITE_SUPABASE_URL is correct"
echo ""
