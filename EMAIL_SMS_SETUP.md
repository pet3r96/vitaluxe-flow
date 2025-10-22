# Email & SMS Configuration Guide

## Overview
AWS SES/SNS has been removed and replaced with:
- **Email**: OAuth email service
- **SMS**: GoHighLevel (GHL) API using toll-free number

## Required Environment Variables

### OAuth Email Configuration
Add these secrets to your Lovable Cloud environment:

```
OAUTH_EMAIL_CLIENT_ID=your_oauth_client_id
OAUTH_EMAIL_CLIENT_SECRET=your_oauth_client_secret
OAUTH_EMAIL_REFRESH_TOKEN=your_oauth_refresh_token
FROM_EMAIL=notifications@vitaluxeservice.com
```

### GHL SMS Configuration
Add these secrets to your Lovable Cloud environment:

```
GHL_API_KEY=your_ghl_api_key
GHL_TOLL_FREE_NUMBER=+1XXXXXXXXXX
```

## Affected Edge Functions

### Email Functions (OAuth)
1. **send-notification** - In-app notifications with email support
2. **send-temp-password-email** - Temporary password emails for new users
3. **send-verification-email** - Email verification for new signups
4. **send-welcome-email** - Welcome emails and password resets

### SMS Functions (GHL)
1. **send-notification** - In-app notifications with SMS support
2. **send-2fa-code** - Two-factor authentication codes

## Implementation Status

### ✅ Completed
- Removed all AWS SES imports and code
- Removed all AWS SNS/Twilio imports and code
- Added OAuth email credential checks
- Added GHL SMS integration code
- Functions log what emails/SMS would send

### 🚧 To-Do
- Implement OAuth token refresh logic
- Implement actual OAuth email sending
- Test GHL SMS delivery
- Configure OAuth credentials in Lovable Cloud
- Configure GHL credentials in Lovable Cloud

## GHL SMS Integration Details

The integration uses the GHL Conversations API to send SMS messages **without creating contacts** in your CRM:

```javascript
POST https://services.leadconnectorhq.com/conversations/messages
Headers:
  Authorization: Bearer {GHL_API_KEY}
  Content-Type: application/json
  Version: 2021-07-28

Body:
{
  "type": "SMS",
  "contactPhone": "+1234567890",
  "phone": "{YOUR_TOLL_FREE_NUMBER}",
  "message": "Your message here"
}
```

This sends SMS directly without polluting your GHL contacts database.

## OAuth Email Implementation Guide

You'll need to implement OAuth token refresh and email sending. Here's the recommended approach:

1. **Token Refresh**: 
   - Use OAuth refresh token to get new access token
   - Store access token with expiry
   - Refresh before expiry

2. **Email Sending**:
   - Use Gmail API, Microsoft Graph, or similar
   - Send via SMTP with OAuth authentication
   - Handle rate limits appropriately

3. **Example OAuth Flow** (Gmail):
```javascript
// Refresh access token
const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_id: oauthClientId,
    client_secret: oauthClientSecret,
    refresh_token: oauthRefreshToken,
    grant_type: 'refresh_token'
  })
});

const { access_token } = await tokenResponse.json();

// Send email via Gmail API
const emailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    raw: base64EncodedEmail
  })
});
```

## Testing

### Development Mode
All functions currently log what they would send but don't actually send emails/SMS until you configure the credentials.

### Production Checklist
- [ ] Add OAuth email credentials to Lovable Cloud
- [ ] Add GHL API key to Lovable Cloud
- [ ] Add GHL toll-free number to Lovable Cloud
- [ ] Test email delivery
- [ ] Test SMS delivery
- [ ] Verify 2FA flows
- [ ] Verify password reset flows
- [ ] Verify welcome email flows

## Migration Notes

### Removed Services
- **AWS SES** - Email sending
- **AWS SNS** - SMS sending  
- **Twilio** - SMS sending (was placeholder)

### Benefits of New Setup
- ✅ No AWS dependencies
- ✅ GHL SMS doesn't create CRM contacts
- ✅ OAuth email more flexible
- ✅ Better control over email delivery
- ✅ Single toll-free number for all SMS

## Support

If you encounter issues:
1. Check Lovable Cloud logs for error messages
2. Verify all environment variables are set
3. Test GHL API key with their API explorer
4. Verify OAuth credentials are valid
5. Check rate limits on both services
