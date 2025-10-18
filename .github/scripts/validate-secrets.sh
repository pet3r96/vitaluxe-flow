#!/usr/bin/env bash
# validate-secrets.sh — prints masked presence of required secrets (no values)
set -euo pipefail

required_secrets=(
  "AWS_ROLE_ARN"
  "AWS_REGION"
  "ECR_REPOSITORY"
  "LIGHTSAIL_SERVICE_NAME"
)

MISSING=false
for secret in "${required_secrets[@]}"; do
  if [ -z "${!secret:-}" ]; then
    echo "::error::Missing required secret: $secret"
    MISSING=true
  else
    echo "$secret: **** (set)"
  fi
done

if [ "$MISSING" = true ]; then
  echo "::error::One or more required secrets are missing. Aborting."
  exit 1
fi

echo "All required secrets are present (masked)."