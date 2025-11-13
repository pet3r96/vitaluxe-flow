# Telehealth Waiting Room - Testing Guide

## Prerequisites
- Two separate browsers or incognito windows
- Provider account credentials
- Patient account credentials
- A valid video session ID

## Testing Steps

### Step 1: Open Provider View
1. In Browser 1, log in as a **Provider/Practice user**
2. Navigate to: `/practice/video/f2f492fa-bd01-4908-8444-dea073472761`
3. Open browser console (F12 → Console tab)
4. You should see:
   - ✅ "Loading secure video room…" message
   - 🔄 "[Realtime] Setting up subscription" log
   - 📡 "[Realtime] Subscription status: SUBSCRIBED"
   - 🎥 "[Agora] Joining channel..." log
   - ✅ "[Agora] Successfully joined channel"
   - Provider video should appear in bottom-right corner
   - "Waiting Room" card should appear in top-right (showing "No patients waiting")

### Step 2: Open Patient View
1. In Browser 2, log in as a **Patient user**
2. Navigate to: `/patient/video/f2f492fa-bd01-4908-8444-dea073472761`
3. Open browser console (F12 → Console tab)
4. You should see:
   - ✅ "Connecting to your secure visit…" message
   - 🔄 "[Realtime] Setting up subscription" log
   - 📡 "[Realtime] Subscription status: SUBSCRIBED"
   - 🎥 "[Agora] Joining channel..." log
   - ✅ "[Agora] Successfully joined channel"
   - 📤 "[Patient] Broadcasting patient_waiting event"
   - Overlay message: "Waiting for provider to admit you..."

### Step 3: Verify Waiting Room Display
Switch back to **Browser 1 (Provider)**:
1. Check the console for:
   - 📩 "[Realtime] Event received" with event_type: "patient_waiting"
   - 👤 "[Provider] Patient joined waiting room: [patient_uid]"
   - ✅ "[Provider] Adding patient to waiting list"
2. Check the UI:
   - "Waiting Room" card in top-right should show 1 patient
   - Patient UID should be displayed
   - "Admit" button should be visible

### Step 4: Admit Patient
In **Browser 1 (Provider)**:
1. Click the **"Admit"** button next to the patient
2. Check the console for:
   - ✅ "[Provider] Admitting patient: [patient_uid]"
   - 📤 "[Provider] Admission event sent successfully"
3. Patient should disappear from waiting room list

### Step 5: Verify Patient Admission
Switch to **Browser 2 (Patient)**:
1. Check the console for:
   - 📩 "[Realtime] Event received" with event_type: "patient_admitted"
   - 🎉 "[Patient] Admitted by provider!"
   - 🎥 "[Patient] Admitted! Publishing tracks..."
   - ✅ "[Agora] Tracks published successfully"
2. Check the UI:
   - Waiting room overlay should disappear
   - Patient's own video should appear in bottom-right corner
   - Provider's video should appear in the main grid

### Step 6: Verify Both Videos Display
Check **both browsers**:
1. **Browser 1 (Provider)** should show:
   - Own video in bottom-right
   - Patient video in main grid
   - Console: "[Agora] user-published" events
2. **Browser 2 (Patient)** should show:
   - Own video in bottom-right
   - Provider video in main grid
   - Console: "[Agora] user-published" events

## Common Issues & Solutions

### Issue: Patient doesn't appear in waiting room
**Possible causes:**
- ❌ Realtime subscription failed
- ❌ patient_waiting event not sent
- ❌ Wrong session ID

**Debug steps:**
1. Check patient console for "Broadcasting patient_waiting event" log
2. Check provider console for "Event received" log
3. Verify both users are on the SAME session ID
4. Check Supabase realtime subscription status

### Issue: Patient not admitted after clicking "Admit"
**Possible causes:**
- ❌ patient_admitted event not sent
- ❌ Patient not listening for event
- ❌ Wrong UID in event

**Debug steps:**
1. Check provider console for "Admission event sent successfully"
2. Check patient console for "Event received" with event_type: "patient_admitted"
3. Verify UID matches between admission event and patient's UID

### Issue: Videos not displaying
**Possible causes:**
- ❌ Agora credentials invalid
- ❌ Tracks not published
- ❌ Camera/microphone permission denied

**Debug steps:**
1. Check console for "Tracks published successfully"
2. Check for Agora error codes (101, 109, 110)
3. Check browser permissions for camera/microphone
4. Verify VITE_AGORA_APP_ID in .env file

### Issue: "Invalid Agora App ID" error
**Solution:**
1. Verify `.env` file has correct `VITE_AGORA_APP_ID`
2. Verify Supabase secrets have correct `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE`
3. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)

## Console Log Reference

### Success Flow Logs:
```
🔄 [Realtime] Setting up subscription
📡 [Realtime] Subscription status: SUBSCRIBED
🎥 [Agora] Joining channel...
✅ [Agora] Successfully joined channel
📤 [Patient] Broadcasting patient_waiting event  (patient only)
📩 [Realtime] Event received  (both)
👤 [Provider] Patient joined waiting room  (provider only)
✅ [Provider] Admitting patient  (provider only)
🎉 [Patient] Admitted by provider!  (patient only)
🎥 [Agora] Creating and publishing local tracks...
✅ [Agora] Tracks published successfully
```

### Error Logs to Watch For:
```
❌ [Agora] Join failed
❌ [Agora] Failed to publish tracks
❌ [Provider] Failed to admit patient
❌ [Realtime] Subscription failed
```

## Additional Testing

### Test Chart Drawer
1. Provider clicks "Chart" button in control bar
2. Patient chart drawer should slide in from right
3. Verify patient data displays correctly
4. Add a provider note and verify it saves

### Test Control Bar
1. Test mic toggle (should mute/unmute)
2. Test camera toggle (should show/hide video)
3. Test chat panel (should open side panel)
4. Test participants panel (should show user count)
5. Test end call (should redirect to calendar/dashboard)

## Troubleshooting Commands

### Check Supabase Realtime Events
```sql
SELECT * FROM video_session_events 
WHERE session_id = 'f2f492fa-bd01-4908-8444-dea073472761'
ORDER BY created_at DESC
LIMIT 10;
```

### Check Video Session
```sql
SELECT * FROM video_sessions 
WHERE id = 'f2f492fa-bd01-4908-8444-dea073472761';
```

### Verify Agora Tokens
Check that `/functions/v1/agora-token` returns valid tokens with correct structure:
```json
{
  "rtcToken": "...",
  "rtmToken": "...",
  "uid": "...",
  "rtmUid": "..."
}
```
