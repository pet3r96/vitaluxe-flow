# Video Call Test Guide

## Overview
The Video Call Test page allows users to verify their camera, microphone, and network quality before joining a video consultation.

## Access
Navigate to: `/video/test`

Direct URL: `https://your-domain.com/video/test`

## Features

### 1. Camera Test
- **What it tests**: Camera device access and video capture
- **What you'll see**: Live camera preview
- **Pass criteria**: Camera feed appears in the preview window
- **Common issues**:
  - Camera permission denied → Allow camera access in browser settings
  - No camera found → Connect a camera device
  - Camera already in use → Close other applications using the camera

### 2. Microphone Test  
- **What it tests**: Microphone device access and audio capture
- **What you'll see**: Real-time audio level indicator
- **Pass criteria**: Audio levels respond when you speak
- **Common issues**:
  - Microphone permission denied → Allow microphone access in browser settings
  - No microphone found → Connect a microphone
  - No audio detected → Check microphone is not muted

### 3. Network Quality Test
- **What it tests**: Internet connection speed and latency
- **What you'll see**: Latency measurement in milliseconds
- **Pass criteria**:
  - Excellent: <150ms latency
  - Good: 150-300ms latency
  - Warning: >300ms latency
- **Common issues**:
  - High latency → Use Wi-Fi or ethernet instead of mobile data
  - Network unreachable → Check internet connection

### 4. Browser Compatibility Test
- **What it tests**: WebRTC support and codec availability
- **What you'll see**: Browser compatibility status and codec support (VP8/H264)
- **Pass criteria**: Browser supports WebRTC and required codecs
- **Common issues**:
  - Browser not supported → Use Chrome, Firefox, Safari, or Edge
  - Media devices unavailable → Update your browser

## How to Use

### Step 1: Run the Test
1. Navigate to `/video/test`
2. Click "Start Test"
3. Allow camera and microphone permissions when prompted
4. Wait for all tests to complete (approximately 10 seconds)

### Step 2: Review Results
Each test will show one of the following statuses:
- ✅ **Passed** (green checkmark) - Test successful
- ⚠️ **Warning** (yellow alert) - Test passed with issues
- ❌ **Failed** (red X) - Test failed
- 🔄 **Testing** (spinner) - Test in progress

### Step 3: Fix Issues
If any tests fail:
1. Read the error message and details
2. Follow the troubleshooting tips shown
3. Click "Run Tests Again" after fixing issues
4. Repeat until all tests pass

### Step 4: Continue to Video Call
Once all tests pass:
1. Click "Continue to Video Call"
2. You'll be returned to your previous page
3. Join your video consultation with confidence

## Troubleshooting

### Camera Issues
**Permission Denied**
- Chrome: Settings → Privacy and security → Site Settings → Camera
- Firefox: Click lock icon in address bar → Permissions → Camera
- Safari: Safari → Settings → Websites → Camera

**Camera Already in Use**
- Close other tabs or applications using the camera
- Restart your browser
- Check system settings for applications with camera access

### Microphone Issues
**No Audio Detected**
- Check microphone is not muted (physical mute button)
- Check system volume settings
- Select correct microphone in browser settings
- Test microphone in system settings first

**Permission Denied**
- Chrome: Settings → Privacy and security → Site Settings → Microphone
- Firefox: Click lock icon in address bar → Permissions → Microphone
- Safari: Safari → Settings → Websites → Microphone

### Network Issues
**High Latency**
- Move closer to Wi-Fi router
- Use ethernet connection instead of Wi-Fi
- Disconnect other devices from network
- Close bandwidth-heavy applications (streaming, downloads)
- Contact your internet service provider

**Connection Failed**
- Check internet connection is active
- Try disabling VPN or firewall temporarily
- Restart your router
- Check if ports are blocked by corporate firewall

### Browser Issues
**Browser Not Supported**
- Update your current browser to the latest version
- Switch to a supported browser:
  - Google Chrome (recommended)
  - Mozilla Firefox
  - Safari (macOS/iOS)
  - Microsoft Edge

**WebRTC Not Available**
- Clear browser cache and cookies
- Disable browser extensions that might block WebRTC
- Reset browser settings to default
- Reinstall browser if issues persist

## Best Practices

### Before Every Call
1. Run the video test
2. Ensure all tests pass
3. Close unnecessary applications
4. Use headphones to prevent echo
5. Find a quiet location with good lighting

### Recommended Setup
- **Browser**: Latest version of Chrome or Edge
- **Internet**: Wi-Fi or ethernet (minimum 2 Mbps upload/download)
- **Audio**: Headset or earbuds (better than laptop speakers)
- **Camera**: Built-in or external webcam (720p or higher)
- **Lighting**: Face a window or light source

### During the Test
- **Speak normally** when testing microphone
- **Look at the camera** to verify video angle
- **Check your background** appears appropriate
- **Verify audio quality** by listening to echoes or distortion
- **Note latency values** for network quality

## Integration Points

### Adding Test Link to Your App
You can add a "Test Your Setup" button anywhere in your app:

```tsx
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

<Link to="/video/test">
  <Button variant="outline">
    Test Camera & Microphone
  </Button>
</Link>
```

### Before Video Calls
Consider showing this page before users join video calls:

```tsx
// In your video room entry point
const handleJoinCall = () => {
  // Option 1: Always test first
  navigate("/video/test");
  
  // Option 2: Ask if they want to test
  if (confirm("Test your camera and microphone first?")) {
    navigate("/video/test");
  } else {
    navigate(`/video/${sessionId}`);
  }
};
```

### Pre-Call Reminder
Add a reminder in appointment confirmation emails:
```
"Before your appointment, please test your camera and microphone at: 
https://your-domain.com/video/test"
```

## Technical Details

### Tested Components
- **Agora SDK**: Creates test camera/microphone tracks
- **WebRTC**: Checks browser support and codec availability
- **Network**: Measures latency to Supabase endpoint
- **Devices**: Enumerates available cameras and microphones

### Test Duration
- Browser test: <1 second
- Camera test: 1-2 seconds
- Microphone test: 3-5 seconds
- Network test: 1-2 seconds
- **Total**: ~10 seconds

### Data Privacy
- All tests run locally in the browser
- No video or audio is transmitted to servers
- No test data is stored or logged
- Camera/microphone tracks are destroyed after testing

### Browser Requirements
- Chrome 74+
- Firefox 63+
- Safari 12.1+
- Edge 79+
- Mobile Safari 12.1+ (iOS)
- Chrome Mobile 74+ (Android)

## Support

### Common Questions

**Q: Do I need to run this test every time?**
A: It's recommended, especially if you've changed devices or locations since your last call.

**Q: What if tests fail on mobile?**
A: Mobile browsers have stricter permissions. Ensure you've granted all required permissions in iOS/Android settings.

**Q: Can I skip the test?**
A: Yes, but it's not recommended. Issues during calls are harder to diagnose than before calls.

**Q: How accurate is the network test?**
A: It measures latency to our servers, which is a good indicator but not perfect. Actual call quality may vary.

**Q: What if my company firewall blocks the test?**
A: Contact your IT department to allow WebRTC traffic and our domain.

### Getting Help
If you continue to have issues after troubleshooting:
1. Note which specific test is failing
2. Copy the error message details
3. Take a screenshot of the test results
4. Contact support with this information

## Updates and Maintenance

This test page is automatically updated with:
- New browser support checks
- Improved error messages
- Additional device compatibility tests
- Network quality improvements

No user action required for updates.
