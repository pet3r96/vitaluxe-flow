# Agora Integration Deployment Checklist

## Environment Variables Required

### Backend (Supabase Secrets)
```bash
AGORA_APP_ID=2443c37d5f97424c8b7e1c08e3a3032e
AGORA_APP_CERTIFICATE=adbffd32577b44b595cdcefe1276f6cc
```

### Frontend (.env)
```bash
VITE_AGORA_APP_ID=2443c37d5f97424c8b7e1c08e3a3032e
```

## Edge Functions Deployed

### Primary Token Endpoint
- **Path**: `/functions/v1/generate-agora-token`
- **Method**: POST
- **Auth**: Public (for dev) - ⚠️ **TODO: Lock with JWT in production**
- **Purpose**: Generates both RTC and RTM tokens using AccessToken2

### Request Format
```json
{
  "channel": "demo",
  "uid": "user_123",
  "role": "publisher",
  "expireSeconds": 3600
}
```

### Response Format
```json
{
  "rtcToken": "007...",
  "rtmToken": "007...",
  "expiresAt": 1234567890,
  "channel": "demo",
  "uid": "user_123",
  "role": "publisher"
}
```

## Core Components

### Hook
- `src/hooks/useAgoraCall.ts` - Manages RTC client lifecycle, token fetching, auto-renewal

### UI Components
- `src/components/video/AgoraVideoRoom.tsx` - Main video room component
- `src/pages/dev/QuickAgoraTest.tsx` - Dev test page

### Page Integration
- `src/pages/patient/PatientVideoRoom.tsx`
- `src/pages/practice/VideoConsultationRoom.tsx`
- `src/pages/public/VideoGuestJoin.tsx`

## Testing Steps

### 1. Basic Connection Test
1. Open `/dev/agora` in **two different browsers** (or incognito + regular)
2. In Browser 1:
   - Channel: `demo`
   - User ID: `tester_1`
   - Click **Join**
3. In Browser 2:
   - Channel: `demo`
   - User ID: `tester_2`
   - Click **Join**
4. **Verify**:
   - ✅ Both users see their own local video
   - ✅ Both users see each other's remote video
   - ✅ Connection status shows "Connected"

### 2. Token Auto-Renewal Test

#### Option A: Wait for Natural Expiry (1 hour)
1. Join a session
2. Keep session open for ~55-60 minutes
3. Verify token auto-renews without disconnection

#### Option B: Force Quick Renewal (Recommended for testing)
1. Edit `src/hooks/useAgoraCall.ts`:
   ```typescript
   // Change line ~38
   expireSeconds: 180  // 3 minutes instead of 3600
   ```
2. Join session
3. Wait 2-3 minutes
4. Check browser console for "Token will expire soon" message
5. Verify automatic renewal without disconnection
6. **Restore to 3600 after testing**

### 3. Production Page Test
1. Create a test video session in the app
2. Join from `/patient/video-room` or `/practice/video-consultation`
3. Verify video connection works identically to dev page

## Rollback Instructions

If issues arise and you need to revert to the old Agora implementation:

### 1. Re-enable Quarantined Code
Search for `// 🧹 TODO AGORA REFACTOR` comments and uncomment the code blocks below them.

### 2. Restore Previous Hooks
```bash
# The old hooks are still in the codebase but commented out
# Look for sections marked with:
// 🧹 QUARANTINED - Old Agora implementation
```

### 3. Revert Component Changes
- `src/components/video/AgoraVideoRoom.tsx` - Restore old `initClient` logic
- Page components - Restore old token fetching logic

### 4. Remove New Files
```bash
rm src/hooks/useAgoraCall.ts
rm src/pages/dev/QuickAgoraTest.tsx
rm supabase/functions/generate-agora-token/index.ts
rm supabase/functions/_shared/agoraTokenService.ts
```

### 5. Restore Old Edge Function
Re-enable `supabase/functions/agora-token/index.ts` if it was disabled.

## Security Notes

⚠️ **Current Status**: `generate-agora-token` is **public** for development ease.

### Before Production:
1. Set `verify_jwt = true` in `supabase/config.toml`
2. Add JWT validation in function
3. Verify authenticated users only can generate tokens
4. Consider rate limiting per user

## Monitoring Checklist

- [ ] Environment variables set correctly in production
- [ ] Edge function deployed and reachable
- [ ] Token format validated (starts with "007")
- [ ] Auto-renewal triggers before expiry
- [ ] No console errors during 1:1 calls
- [ ] Video quality acceptable on test connections

## Known Limitations

- Chat/RTM integration pending (marked with TODO comments)
- Screen sharing controls pending
- Multi-party calls not yet implemented (hook is 1:1 focused)
- Recording integration pending

---

**Last Updated**: 2025-11-12  
**Status**: ✅ Ready for staging deployment  
**Next Steps**: Complete production testing, enable JWT protection, restore RTM chat
