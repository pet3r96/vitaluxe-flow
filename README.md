# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/c3f5b3e3-6069-4d4f-99ce-8809fbc21ade

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/c3f5b3e3-6069-4d4f-99ce-8809fbc21ade) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

This project is automatically deployed to AWS Lightsail via GitHub Actions when you push to the main branch.

### Required GitHub Secrets

Before deployment, ensure these secrets are configured in your GitHub repository settings:

- `AWS_ROLE_ARN` - AWS IAM role ARN for deployment
- `AWS_REGION` - AWS region (e.g., us-west-2)
- `ECR_REPOSITORY` - ECR repository URL
- `LIGHTSAIL_SERVICE_NAME` - Lightsail container service name
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Your Supabase publishable key

### Deployment Process

1. Push changes to the main branch
2. GitHub Actions automatically builds and deploys to Lightsail
3. Check the Actions tab for deployment status and diagnostics

## Troubleshooting Deployment Issues

### Check Service Status

```bash
# Check Lightsail service status
aws lightsail get-container-services --service-name vitaluxe-app

# Get detailed service information
aws lightsail get-container-services --service-name vitaluxe-app --query "containerServices[0].{State:state,NextDeployment:nextDeployment.state,Url:url,Power:power,Scale:scale}" --output table
```

### View Container Logs

```bash
# List log groups
aws logs describe-log-groups --log-group-name-prefix "/aws/lightsail/vitaluxe-app"

# Get recent logs (replace LOG_GROUP_NAME with actual group name)
aws logs get-log-events --log-group-name LOG_GROUP_NAME --start-time $(date -d '1 hour ago' +%s)000
```

### Test Service Health

```bash
# Test if service is responding
curl -I https://vitaluxe-app.rdeacw2yw3h2y.us-west-2.cs.amazonlightsail.com/

# Check HTTP status
curl -s -o /dev/null -w "%{http_code}" https://vitaluxe-app.rdeacw2yw3h2y.us-west-2.cs.amazonlightsail.com/
```

### Common Issues

1. **Service not responding**: Check if environment variables are properly set in GitHub secrets
2. **Build failures**: Verify all required secrets are present
3. **Container crashes**: Check container logs for runtime errors
4. **DNS issues**: Verify the Lightsail service URL is correct

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
