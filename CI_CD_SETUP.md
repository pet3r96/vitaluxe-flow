# CI/CD Setup for Supabase Edge Functions

This guide configures GitHub Actions to automatically deploy edge functions on every push to the main branch.

## Prerequisites

- Supabase CLI access token
- GitHub repository with Actions enabled
- Completed local CLI setup (see SUPABASE_CLI_SETUP.md)

## Step 1: Generate Supabase Access Token

From your terminal:

```bash
supabase login
```

Then generate a token:

```bash
# This outputs a long-lived access token
supabase auth export
```

Copy the entire token that starts with `sbp_...`

## Step 2: Add GitHub Secret

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `SUPABASE_ACCESS_TOKEN`
5. Value: Paste the token from Step 1
6. Click **Add secret**

## Step 3: Add Project Reference Secret

Add another secret for the project reference:

1. Click **New repository secret**
2. Name: `SUPABASE_PROJECT_REF`
3. Value: `qbtsfajshnrwwlfzkeog`
4. Click **Add secret**

## Step 4: Verify GitHub Actions Workflow

The workflow file is already configured at `.github/workflows/deploy-functions.yml`. It will:

- Trigger on every push to `main`
- Install Supabase CLI
- Deploy all edge functions
- Report deployment status

## Step 5: Test the CI/CD Pipeline

Make a small change to test:

```bash
# Edit a non-critical function to add a log
echo '// CI/CD test' >> supabase/functions/edge-ping/index.ts

git add .
git commit -m "test: CI/CD deployment"
git push origin main
```

Monitor the deployment:

1. Go to **Actions** tab in GitHub
2. Click on the running workflow
3. Watch the **Deploy Functions** step

Expected output:
```
Deploying functions...
✓ generate-agora-token deployed
✓ join-video-session deployed
✓ validate-video-guest-link deployed
... (all functions)
Deployment complete!
```

## Step 6: Set Up Deployment Notifications (Optional)

Configure Slack/Discord notifications for deployment status:

### Slack Integration

1. Create a Slack webhook URL
2. Add it as a GitHub secret: `SLACK_WEBHOOK_URL`
3. The workflow will automatically post deployment results

### Discord Integration

1. Create a Discord webhook URL
2. Add it as a GitHub secret: `DISCORD_WEBHOOK_URL`
3. The workflow will automatically post deployment results

## Workflow Configuration Details

The workflow performs these steps:

1. **Checkout code**: Clones the repository
2. **Setup Supabase CLI**: Installs the CLI tool
3. **Link project**: Authenticates with access token
4. **Deploy functions**: Deploys all functions in `supabase/functions/`
5. **Verify deployment**: Checks function status
6. **Report results**: Posts success/failure status

## Advanced Configuration

### Deploy Only Changed Functions

To optimize CI/CD and deploy only changed functions, modify the workflow to:

1. Detect which functions changed
2. Deploy only those functions
3. Skip unchanged functions

This is configured in the workflow file under the `changed-functions` job.

### Deploy to Staging First

For production safety, deploy to a staging environment first:

1. Create a staging Supabase project
2. Add `SUPABASE_STAGING_PROJECT_REF` secret
3. Configure workflow to deploy to staging on PR
4. Deploy to production on merge to main

### Rollback Strategy

If a deployment fails:

1. **Automatic**: The workflow will fail and not update functions
2. **Manual**: Revert the commit and push
3. **CLI**: Use `supabase functions deploy <function-name>@<previous-version>`

## Monitoring Deployments

### View Deployment Logs

```bash
# View recent deployments
gh run list --workflow=deploy-functions.yml

# View specific run logs
gh run view <run-id> --log
```

### Check Function Status After Deployment

```bash
# List all functions
supabase functions list

# Check specific function logs
supabase functions logs generate-agora-token --limit 20
```

### Test Endpoints After Deployment

```bash
# Test public endpoint
curl https://qbtsfajshnrwwlfzkeog.supabase.co/functions/v1/agora-echo

# Test authenticated endpoint
curl -X POST https://qbtsfajshnrwwlfzkeog.supabase.co/functions/v1/generate-agora-token \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test"}'
```

## Troubleshooting

### Issue: "Authentication failed"

**Solution**: Regenerate and update the access token:
```bash
supabase auth export
# Update SUPABASE_ACCESS_TOKEN in GitHub secrets
```

### Issue: "Function deployment failed"

**Solution**: Check the GitHub Actions logs for specific errors. Common causes:
- TypeScript errors in function code
- Missing dependencies
- Invalid imports

### Issue: "Workflow not triggering"

**Solution**: 
1. Ensure the workflow file is in `.github/workflows/`
2. Check if Actions are enabled in repository settings
3. Verify the branch name matches the trigger (`main`)

### Issue: "Functions deployed but not working"

**Solution**:
1. Check if secrets are properly set in Supabase
2. Verify function logs for runtime errors
3. Test endpoints with curl

## Security Best Practices

1. **Never commit tokens**: Keep `SUPABASE_ACCESS_TOKEN` in GitHub secrets only
2. **Rotate tokens**: Regenerate access tokens every 90 days
3. **Limit token scope**: Use project-specific tokens when possible
4. **Monitor deployments**: Set up alerts for failed deployments
5. **Review PRs**: Always review function changes before merging

## Next Steps

1. ✅ Generate access token
2. ✅ Add GitHub secrets
3. ✅ Test deployment with a small change
4. ✅ Monitor first deployment
5. ✅ Set up notifications (optional)
6. ➡️ Configure staging environment (optional)
7. ➡️ Set up automated testing (optional)

## Support

For CI/CD issues:
- Check GitHub Actions logs
- Review Supabase function logs: `supabase functions logs <function-name>`
- Verify secrets are correctly configured
- Test deployment manually with CLI first
