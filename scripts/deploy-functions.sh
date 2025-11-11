#!/bin/bash

# Deploy Supabase Edge Functions
# Usage: ./scripts/deploy-functions.sh [function-name]
# If no function name is provided, deploys all functions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${YELLOW}➜${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    print_error "Supabase CLI not found. Please install it first:"
    echo "  macOS: brew install supabase/tap/supabase"
    echo "  npm:   npm install -g supabase"
    exit 1
fi

# Check if we're in the project root
if [ ! -d "supabase/functions" ]; then
    print_error "Must be run from project root directory"
    exit 1
fi

# Project reference
PROJECT_REF="qbtsfajshnrwwlfzkeog"

print_status "Checking Supabase CLI authentication..."

# Check if already linked
if ! supabase projects list &> /dev/null; then
    print_error "Not authenticated. Please run: supabase login"
    exit 1
fi

print_success "Authenticated successfully"

# Link to project if not already linked
print_status "Linking to project $PROJECT_REF..."
supabase link --project-ref "$PROJECT_REF" 2>/dev/null || print_success "Already linked"

# Function to deploy a single function
deploy_function() {
    local func_name=$1
    print_status "Deploying $func_name..."
    
    if supabase functions deploy "$func_name" --no-verify-jwt; then
        print_success "$func_name deployed successfully"
        return 0
    else
        print_error "$func_name deployment failed"
        return 1
    fi
}

# If a specific function is provided, deploy only that
if [ $# -eq 1 ]; then
    FUNCTION_NAME=$1
    print_status "Deploying single function: $FUNCTION_NAME"
    
    if [ ! -d "supabase/functions/$FUNCTION_NAME" ]; then
        print_error "Function $FUNCTION_NAME not found"
        exit 1
    fi
    
    deploy_function "$FUNCTION_NAME"
    exit $?
fi

# Deploy all functions
print_status "Deploying all edge functions..."

FAILED_FUNCTIONS=()
SUCCESS_COUNT=0
TOTAL_COUNT=0

for function_dir in supabase/functions/*/; do
    if [ -d "$function_dir" ]; then
        function_name=$(basename "$function_dir")
        
        # Skip _shared directory
        if [ "$function_name" = "_shared" ]; then
            continue
        fi
        
        TOTAL_COUNT=$((TOTAL_COUNT + 1))
        
        if deploy_function "$function_name"; then
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        else
            FAILED_FUNCTIONS+=("$function_name")
        fi
        
        echo "" # Add spacing between functions
    fi
done

# Print summary
echo ""
echo "================================================"
echo "Deployment Summary"
echo "================================================"
echo "Total functions: $TOTAL_COUNT"
echo "Successful: $SUCCESS_COUNT"
echo "Failed: ${#FAILED_FUNCTIONS[@]}"
echo ""

if [ ${#FAILED_FUNCTIONS[@]} -eq 0 ]; then
    print_success "All functions deployed successfully!"
    echo ""
    echo "Next steps:"
    echo "  1. Test endpoints: curl https://$PROJECT_REF.supabase.co/functions/v1/agora-echo"
    echo "  2. View logs: supabase functions logs <function-name>"
    echo "  3. Test in app: Try joining a video session"
    exit 0
else
    print_error "Some functions failed to deploy:"
    for func in "${FAILED_FUNCTIONS[@]}"; do
        echo "  - $func"
    done
    echo ""
    echo "To troubleshoot:"
    echo "  1. Check function logs: supabase functions logs $func"
    echo "  2. Test locally: supabase functions serve $func"
    echo "  3. Verify function code for errors"
    exit 1
fi
