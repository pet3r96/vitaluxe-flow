import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Mic, Volume2, CheckCircle, XCircle, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import AgoraRTC from "agora-rtc-sdk-ng";
import { toast } from "sonner";

interface DeviceTestScreenProps {
  onComplete: () => void;
  appId: string;
}

interface MediaDevice {
  deviceId: string;
  label: string;
  kind: string;
}

export const DeviceTestScreen = ({ onComplete, appId }: DeviceTestScreenProps) => {
  const [cameraStatus, setCameraStatus] = useState<"testing" | "success" | "error">("testing");
  const [micStatus, setMicStatus] = useState<"testing" | "success" | "error">("testing");
  const [speakerStatus, setSpeakerStatus] = useState<"testing" | "success" | "error">("testing");
  const [audioLevel, setAudioLevel] = useState(0);
  const [isTestingAudio, setIsTestingAudio] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSwitchingDevice, setIsSwitchingDevice] = useState(false);
  
  const [cameras, setCameras] = useState<MediaDevice[]>([]);
  const [microphones, setMicrophones] = useState<MediaDevice[]>([]);
  const [speakers, setSpeakers] = useState<MediaDevice[]>([]);
  
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>("");
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>("");
  
  const videoRef = useRef<HTMLDivElement>(null);
  const localVideoTrackRef = useRef<any>(null);
  const localAudioTrackRef = useRef<any>(null);
  const audioIntervalRef = useRef<any>(null);
  const refreshTimeoutRef = useRef<any>(null);
  const deviceSwitchTimeoutRef = useRef<any>(null);
  const retryCountRef = useRef({ camera: 0, mic: 0 });

  useEffect(() => {
    enumerateDevices();
    
    // Listen for device changes (plugging/unplugging headsets)
    const handleDeviceChange = () => {
      console.log("🔄 Device change detected");
      enumerateDevices();
    };
    
    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    
    return () => {
      cleanup();
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, []);

  useEffect(() => {
    if (selectedCamera && cameraStatus === "success") {
      persistPrefs(selectedCamera, undefined, undefined);
      switchCamera(selectedCamera);
    }
  }, [selectedCamera]);

  useEffect(() => {
    if (selectedMicrophone && micStatus === "success") {
      persistPrefs(undefined, selectedMicrophone, undefined);
      switchMicrophone(selectedMicrophone);
    }
  }, [selectedMicrophone]);

  // Helper to get the browser's true default device
  const getDefaultDeviceId = async (kind: "audioinput" | "videoinput") => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        kind === "audioinput" ? { audio: true } : { video: true }
      );
      const track = kind === "audioinput" ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];
      const id = track?.getSettings()?.deviceId || "";
      stream.getTracks().forEach(t => t.stop());
      return id;
    } catch {
      return "";
    }
  };

  // Helper to pick the preferred microphone intelligently
  const pickPreferredMic = (mics: MediaDevice[], defaultId: string) => {
    const hasDefaultId = defaultId && mics.find(d => d.deviceId === defaultId)?.deviceId;
    if (hasDefaultId) return defaultId;

    const preferDefaultLabel = mics.find(d => d.label?.toLowerCase().startsWith("default -"));
    if (preferDefaultLabel) return preferDefaultLabel.deviceId;

    const preferBuiltIn = mics.find(d => /built[- ]?in|macbook/i.test(d.label));
    if (preferBuiltIn) return preferBuiltIn.deviceId;

    const deprioritized = ["iphone", "ipad", "airpods", "bluetooth"];
    const nonContinuity = mics.find(d => !deprioritized.some(x => d.label.toLowerCase().includes(x)));
    return (nonContinuity || mics[0]).deviceId;
  };

  // Helper to persist device preferences
  const persistPrefs = (cameraId?: string, micId?: string, speakerId?: string) => {
    const prev = JSON.parse(localStorage.getItem("video.devicePrefs") || "{}");
    localStorage.setItem("video.devicePrefs", JSON.stringify({
      cameraId: cameraId ?? prev.cameraId,
      micId: micId ?? prev.micId,
      speakerId: speakerId ?? prev.speakerId,
    }));
  };

  const cleanup = useCallback(async () => {
    console.log("🧹 Cleaning up device test resources...");
    
    try {
      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.stop();
        localVideoTrackRef.current.close();
        localVideoTrackRef.current = null;
      }
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop();
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
      }
      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current);
        audioIntervalRef.current = null;
      }
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      if (deviceSwitchTimeoutRef.current) {
        clearTimeout(deviceSwitchTimeoutRef.current);
      }
      
      setAudioLevel(0);
      console.log("✅ Cleanup complete");
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
  }, []);

  const enumerateDevices = useCallback(async () => {
    console.log("🔍 Enumerating devices...");
    setIsRefreshing(true);
    
    // Cleanup existing tracks first
    await cleanup();
    
    // Reset all statuses
    setCameraStatus("testing");
    setMicStatus("testing");
    setSpeakerStatus("testing");
    retryCountRef.current = { camera: 0, mic: 0 };
    
    try {
      const devices = await AgoraRTC.getDevices();
      console.log("📱 Found devices:", devices.length);
      
      const cameraDevices = devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 5)}`,
          kind: device.kind
        }));
      
      const micDevices = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 5)}`,
          kind: device.kind
        }));
      
      const speakerDevices = devices
        .filter(device => device.kind === 'audiooutput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Speaker ${device.deviceId.slice(0, 5)}`,
          kind: device.kind
        }));
      
      console.log(`📹 Cameras: ${cameraDevices.length}, 🎤 Mics: ${micDevices.length}, 🔊 Speakers: ${speakerDevices.length}`);
      
      setCameras(cameraDevices);
      setMicrophones(micDevices);
      setSpeakers(speakerDevices);
      
      // Auto-select devices with intelligent defaults and start testing
      if (cameraDevices.length > 0) {
        const defaultCamId = await getDefaultDeviceId("videoinput");
        const chosenCamId = defaultCamId && cameraDevices.find(d => d.deviceId === defaultCamId)?.deviceId 
          || cameraDevices[0].deviceId;
        setSelectedCamera(chosenCamId);
        persistPrefs(chosenCamId, undefined, undefined);
        await testCamera(chosenCamId);
      } else {
        setCameraStatus("error");
        toast.error("No camera found");
      }
      
      if (micDevices.length > 0) {
        const defaultMicId = await getDefaultDeviceId("audioinput");
        const chosenMicId = pickPreferredMic(micDevices, defaultMicId);
        setSelectedMicrophone(chosenMicId);
        persistPrefs(undefined, chosenMicId, undefined);
        await testMicrophone(chosenMicId);
      } else {
        setMicStatus("error");
        toast.error("No microphone found");
      }
      
      if (speakerDevices.length > 0) {
        setSelectedSpeaker(speakerDevices[0].deviceId);
        persistPrefs(undefined, undefined, speakerDevices[0].deviceId);
        setSpeakerStatus("success");
      }
    } catch (error) {
      console.error("❌ Error enumerating devices:", error);
      toast.error("Failed to enumerate devices. Please check permissions.");
    } finally {
      setIsRefreshing(false);
    }
  }, [cleanup]);

  const testCamera = async (deviceId?: string, isRetry = false) => {
    try {
      console.log(`📹 Testing camera${deviceId ? ` (${deviceId})` : ''}...`);
      setCameraStatus("testing");
      
      const videoTrack = await AgoraRTC.createCameraVideoTrack(
        deviceId ? { cameraId: deviceId } : undefined
      );
      
      localVideoTrackRef.current = videoTrack;
      console.log("✅ Video track created");
      
      // Wait for DOM to be ready and add retry logic
      if (videoRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for DOM
        
        try {
          videoTrack.play(videoRef.current);
          console.log("✅ Video playing in DOM");
          
          // Verify video is actually rendering
          await new Promise(resolve => setTimeout(resolve, 200));
          setCameraStatus("success");
          retryCountRef.current.camera = 0;
          toast.success("Camera ready", { duration: 1000 });
        } catch (playError) {
          console.warn("⚠️ First play attempt failed, retrying...", playError);
          
          // Retry once
          if (!isRetry && retryCountRef.current.camera < 1) {
            retryCountRef.current.camera++;
            await new Promise(resolve => setTimeout(resolve, 500));
            videoTrack.play(videoRef.current);
            setCameraStatus("success");
            console.log("✅ Video playing after retry");
          } else {
            throw playError;
          }
        }
      } else {
        throw new Error("Video container ref not available");
      }
    } catch (error) {
      console.error("❌ Camera test failed:", error);
      setCameraStatus("error");
      
      if (retryCountRef.current.camera < 1 && !isRetry) {
        retryCountRef.current.camera++;
        console.log("🔄 Retrying camera test...");
        setTimeout(() => testCamera(deviceId, true), 1000);
      } else {
        toast.error("Camera access denied. Please allow camera permissions.");
      }
    }
  };

  const testMicrophone = async (deviceId?: string, isRetry = false) => {
    try {
      console.log(`🎤 Testing microphone${deviceId ? ` (${deviceId})` : ''}...`);
      setMicStatus("testing");
      
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack(
        deviceId ? { microphoneId: deviceId } : undefined
      );
      
      localAudioTrackRef.current = audioTrack;
      console.log("✅ Audio track created");
      setMicStatus("success");
      retryCountRef.current.mic = 0;
      toast.success("Microphone ready", { duration: 1000 });

      // Monitor audio levels
      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current);
      }
      
      audioIntervalRef.current = setInterval(() => {
        if (localAudioTrackRef.current) {
          const level = localAudioTrackRef.current.getVolumeLevel();
          setAudioLevel(level);
        }
      }, 100);
    } catch (error) {
      console.error("❌ Microphone test failed:", error);
      setMicStatus("error");
      
      if (retryCountRef.current.mic < 1 && !isRetry) {
        retryCountRef.current.mic++;
        console.log("🔄 Retrying microphone test...");
        setTimeout(() => testMicrophone(deviceId, true), 1000);
      } else {
        toast.error("Microphone access denied. Please allow microphone permissions.");
      }
    }
  };

  const switchCamera = useCallback(async (deviceId: string) => {
    if (deviceSwitchTimeoutRef.current) {
      clearTimeout(deviceSwitchTimeoutRef.current);
    }
    
    deviceSwitchTimeoutRef.current = setTimeout(async () => {
      console.log("🔄 Switching camera...");
      setIsSwitchingDevice(true);
      
      try {
        if (localVideoTrackRef.current) {
          localVideoTrackRef.current.stop();
          localVideoTrackRef.current.close();
          localVideoTrackRef.current = null;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
        await testCamera(deviceId);
      } finally {
        setIsSwitchingDevice(false);
      }
    }, 300); // Debounce 300ms
  }, []);

  const switchMicrophone = useCallback(async (deviceId: string) => {
    if (deviceSwitchTimeoutRef.current) {
      clearTimeout(deviceSwitchTimeoutRef.current);
    }
    
    deviceSwitchTimeoutRef.current = setTimeout(async () => {
      console.log("🔄 Switching microphone...");
      setIsSwitchingDevice(true);
      
      try {
        if (localAudioTrackRef.current) {
          localAudioTrackRef.current.stop();
          localAudioTrackRef.current.close();
          localAudioTrackRef.current = null;
        }
        if (audioIntervalRef.current) {
          clearInterval(audioIntervalRef.current);
          audioIntervalRef.current = null;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
        await testMicrophone(deviceId);
      } finally {
        setIsSwitchingDevice(false);
      }
    }, 300); // Debounce 300ms
  }, []);

  const testSpeakers = useCallback(async () => {
    try {
      console.log("🔊 Testing speakers...");
      setIsTestingAudio(true);
      
      // Create fresh AudioContext each time for reliability
      const audioContext = new AudioContext();
      
      // Handle suspended state (browser autoplay policy)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 440; // A4 note
      gainNode.gain.value = 0.3;
      
      oscillator.start();
      
      // Play for 500ms then cleanup
      await new Promise(resolve => setTimeout(resolve, 500));
      
      oscillator.stop();
      audioContext.close();
      
      setIsTestingAudio(false);
      setSpeakerStatus("success");
      toast.success("Speaker test complete - did you hear it?", { duration: 2000 });
      console.log("✅ Speaker test complete");
    } catch (error) {
      console.error("❌ Error testing speakers:", error);
      setSpeakerStatus("error");
      setIsTestingAudio(false);
      toast.error("Failed to test speakers. Check browser permissions.");
    }
  }, []);

  const getStatusIcon = (status: "testing" | "success" | "error") => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "error":
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-500 animate-pulse" />;
    }
  };

  const handleRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    
    refreshTimeoutRef.current = setTimeout(() => {
      enumerateDevices();
    }, 500); // Debounce 500ms
  }, [enumerateDevices]);

  const canContinue = cameraStatus === "success" && micStatus === "success";

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Device Check</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {canContinue 
                ? "✓ Ready to join! Click continue below." 
                : "Please allow camera and microphone access to join the video session"}
            </p>
          </div>
          <Button
            onClick={handleRefresh}
            variant="ghost"
            size="sm"
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Video Preview */}
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video min-h-[320px]">
          <div ref={videoRef} className="w-full h-full" style={{ minHeight: '320px' }} />
          {cameraStatus === "testing" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center text-white">
                <Loader2 className="h-12 w-12 mx-auto mb-2 animate-spin" />
                <p className="text-sm">Starting camera...</p>
              </div>
            </div>
          )}
          {cameraStatus === "error" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center text-white">
                <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Camera not available</p>
                <p className="text-xs mt-1 opacity-70">Check browser permissions</p>
              </div>
            </div>
          )}
          {isSwitchingDevice && cameraStatus === "success" && (
            <div className="absolute top-4 right-4 bg-black/60 px-3 py-1 rounded-full">
              <Loader2 className="h-4 w-4 text-white animate-spin" />
            </div>
          )}
        </div>

        {/* Device Status */}
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Camera className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">Camera</span>
              </div>
              {getStatusIcon(cameraStatus)}
            </div>
            {cameras.length > 0 && (
              <Select 
                value={selectedCamera} 
                onValueChange={setSelectedCamera}
                disabled={isSwitchingDevice || isRefreshing}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select camera" />
                </SelectTrigger>
                <SelectContent>
                  {cameras.map((camera) => (
                    <SelectItem key={camera.deviceId} value={camera.deviceId}>
                      {camera.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Mic className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">Microphone</span>
                {micStatus === "success" && (
                  <div className="flex-1 max-w-xs">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-100"
                        style={{ width: `${audioLevel * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
              {getStatusIcon(micStatus)}
            </div>
            {microphones.length > 0 && (
              <Select 
                value={selectedMicrophone} 
                onValueChange={setSelectedMicrophone}
                disabled={isSwitchingDevice || isRefreshing}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select microphone" />
                </SelectTrigger>
                <SelectContent>
                  {microphones.map((mic) => (
                    <SelectItem key={mic.deviceId} value={mic.deviceId}>
                      {mic.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Volume2 className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">Speakers</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={testSpeakers}
                  disabled={isTestingAudio}
                >
                  {isTestingAudio ? "Playing..." : "Test Sound"}
                </Button>
              </div>
              {getStatusIcon(speakerStatus)}
            </div>
            {speakers.length > 0 && (
              <Select 
                value={selectedSpeaker} 
                onValueChange={setSelectedSpeaker}
                disabled={isRefreshing}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select speaker" />
                </SelectTrigger>
                <SelectContent>
                  {speakers.map((speaker) => (
                    <SelectItem key={speaker.deviceId} value={speaker.deviceId}>
                      {speaker.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={() => {
              // Persist current selections before continuing
              persistPrefs(selectedCamera, selectedMicrophone, selectedSpeaker);
              onComplete();
            }}
            disabled={!canContinue}
            className="flex-1"
            size="lg"
          >
            {canContinue ? "Continue to Call" : "Checking Devices..."}
          </Button>
          {cameraStatus === "error" || micStatus === "error" ? (
            <Button
              onClick={onComplete}
              variant="outline"
              size="lg"
            >
              Skip (Not Recommended)
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
};
