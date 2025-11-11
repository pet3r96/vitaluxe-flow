# Supabase CLI Setup Guide

This guide walks you through connecting your terminal and CI/CD to the Lovable Cloud Supabase project.

## Prerequisites

- Supabase CLI installed (see installation instructions below)
- Access to the Supabase project
- GitHub repository with write access (for CI/CD)

## Project Details

- **Project ID**: `qbtsfajshnrwwlfzkeog`
- **Project URL**: `https://qbtsfajshnrwwlfzkeog.supabase.co`
- **Region**: Automatically managed by Lovable Cloud

## Part 1: Local Terminal Setup

### Step 1: Install Supabase CLI

**macOS (Homebrew)**:
```bash
brew install supabase/tap/supabase
```

**Windows (Scoop)**:
```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Linux (Binary)**:
```bash
curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar -xz -C /usr/local/bin
```

**npm (All platforms)**:
```bash
npm install -g supabase
```

Verify installation:
```bash
supabase --version
```

### Step 2: Authenticate with Supabase

```bash
supabase login
```

This will open a browser window for authentication. Follow the prompts to log in with your Supabase account.

### Step 3: Link to Project

From your project root directory:

```bash
supabase link --project-ref qbtsfajshnrwwlfzkeog
```

When prompted, select your organization and confirm the project.

### Step 4: Verify Connection

```bash
# List all deployed edge functions
supabase functions list

# Check secrets
supabase secrets list

# View recent logs
supabase functions logs generate-agora-token --limit 50
```

Expected output: You should see 100+ edge functions listed.

## Part 2: Deploy Video Functions

Deploy the critical video functions manually:

```bash
# Deploy all video-related functions
supabase functions deploy generate-agora-token
supabase functions deploy join-video-session  
supabase functions deploy test-agora-token
supabase functions deploy validate-video-guest-link
supabase functions deploy agora-echo
supabase functions deploy agora-healthcheck
```

### Verify Deployment

```bash
# Check logs for each function
supabase functions logs generate-agora-token --limit 10
supabase functions logs join-video-session --limit 10

# Test the echo endpoint (no auth required)
curl https://qbtsfajshnrwwlfzkeog.supabase.co/functions/v1/agora-echo
```

Expected response:
```json
{
  "ok": true,
  "timestamp": "2025-01-11T...",
  "appId": "2443c37d5f97424c8b7e1c08e3a3032e",
  "credentialsValid": true
}
```

## Part 3: Configure Required Secrets

Check if Agora secrets are configured:

```bash
supabase secrets list | grep AGORA
```

If missing, set them:

```bash
supabase secrets set AGORA_APP_ID=2443c37d5f97424c8b7e1c08e3a3032e
supabase secrets set AGORA_APP_CERTIFICATE=adbffd32577b44b595cdcefe1276f6cc
```

**Note**: These secrets are already configured in Lovable Cloud, but you may need to set them locally for CLI access.

## Part 4: Common CLI Commands

### Function Management

```bash
# List all functions
supabase functions list

# Deploy a specific function
supabase functions deploy <function-name>

# Deploy multiple functions
supabase functions deploy function1 function2 function3

# View function logs (live tail)
supabase functions logs <function-name> --follow

# View recent logs
supabase functions logs <function-name> --limit 100
```

### Database Management

```bash
# View database schema
supabase db pull

# Push local migrations
supabase db push

# Reset database (DANGEROUS - use in dev only)
supabase db reset
```

### Secret Management

```bash
# List all secrets
supabase secrets list

# Set a secret
supabase secrets set SECRET_NAME=secret_value

# Set multiple secrets from .env file
supabase secrets set --env-file .env.production
```

## Troubleshooting

### Issue: "Project not found"

**Solution**: Verify you're logged in and have access:
```bash
supabase login
supabase projects list
```

### Issue: "Function deployment failed"

**Solution**: Check function logs for errors:
```bash
supabase functions logs <function-name> --limit 50
```

Common causes:
- Missing environment variables/secrets
- Import errors in TypeScript
- Deno permission issues

### Issue: "Authentication required"

**Solution**: Re-authenticate:
```bash
supabase login
```

### Issue: Functions not appearing in list

**Solution**: Ensure you're linked to the correct project:
```bash
supabase projects list
supabase link --project-ref qbtsfajshnrwwlfzkeog
```

## Next Steps

1. ✅ Complete local CLI setup (Steps 1-4)
2. ✅ Deploy video functions (Part 2)
3. ✅ Verify deployment with curl tests
4. ➡️ Set up CI/CD (see CI_CD_SETUP.md)
5. ➡️ Test video sessions in the app

## Support

If you encounter issues:
1. Check function logs: `supabase functions logs <function-name>`
2. Verify secrets: `supabase secrets list`
3. Test with curl to isolate frontend vs backend issues
4. Check Lovable Cloud status in the dashboard
