import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Mic, Volume2, CheckCircle, XCircle, AlertCircle, RefreshCw } from "lucide-react";
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
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    enumerateDevices();
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (selectedCamera && cameraStatus === "success") {
      switchCamera(selectedCamera);
    }
  }, [selectedCamera]);

  useEffect(() => {
    if (selectedMicrophone && micStatus === "success") {
      switchMicrophone(selectedMicrophone);
    }
  }, [selectedMicrophone]);

  const cleanup = () => {
    if (localVideoTrackRef.current) {
      localVideoTrackRef.current.stop();
      localVideoTrackRef.current.close();
    }
    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.stop();
      localAudioTrackRef.current.close();
    }
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  };

  const enumerateDevices = async () => {
    try {
      const devices = await AgoraRTC.getDevices();
      
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
      
      setCameras(cameraDevices);
      setMicrophones(micDevices);
      setSpeakers(speakerDevices);
      
      // Auto-select first devices and start testing
      if (cameraDevices.length > 0) {
        setSelectedCamera(cameraDevices[0].deviceId);
        testCamera(cameraDevices[0].deviceId);
      }
      if (micDevices.length > 0) {
        setSelectedMicrophone(micDevices[0].deviceId);
        testMicrophone(micDevices[0].deviceId);
      }
      if (speakerDevices.length > 0) {
        setSelectedSpeaker(speakerDevices[0].deviceId);
        setSpeakerStatus("success");
      }
    } catch (error) {
      console.error("Error enumerating devices:", error);
      toast.error("Failed to enumerate devices. Please check permissions.");
    }
  };

  const testCamera = async (deviceId?: string) => {
    try {
      setCameraStatus("testing");
      const videoTrack = await AgoraRTC.createCameraVideoTrack(
        deviceId ? { cameraId: deviceId } : undefined
      );
      localVideoTrackRef.current = videoTrack;
      if (videoRef.current) {
        videoTrack.play(videoRef.current);
      }
      setCameraStatus("success");
    } catch (error) {
      console.error("Camera test failed:", error);
      setCameraStatus("error");
      toast.error("Camera access denied. Please allow camera permissions.");
    }
  };

  const testMicrophone = async (deviceId?: string) => {
    try {
      setMicStatus("testing");
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack(
        deviceId ? { microphoneId: deviceId } : undefined
      );
      localAudioTrackRef.current = audioTrack;
      setMicStatus("success");

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
      console.error("Microphone test failed:", error);
      setMicStatus("error");
      toast.error("Microphone access denied. Please allow microphone permissions.");
    }
  };

  const switchCamera = async (deviceId: string) => {
    if (localVideoTrackRef.current) {
      localVideoTrackRef.current.stop();
      localVideoTrackRef.current.close();
    }
    await testCamera(deviceId);
  };

  const switchMicrophone = async (deviceId: string) => {
    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.stop();
      localAudioTrackRef.current.close();
    }
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
    }
    await testMicrophone(deviceId);
  };

  const testSpeakers = async () => {
    try {
      setIsTestingAudio(true);
      
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      
      const audioContext = audioContextRef.current;
      
      // Resume AudioContext if suspended (browser autoplay policy)
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
      setTimeout(() => {
        oscillator.stop();
        setIsTestingAudio(false);
      }, 500);
      
      setSpeakerStatus("success");
    } catch (error) {
      console.error("Error testing speakers:", error);
      setSpeakerStatus("error");
      setIsTestingAudio(false);
      toast.error("Failed to test speakers");
    }
  };

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

  const canContinue = cameraStatus === "success" && micStatus === "success";

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Device Check</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Please allow camera and microphone access to join the video session
            </p>
          </div>
          <Button
            onClick={enumerateDevices}
            variant="ghost"
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Video Preview */}
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
          <div ref={videoRef} className="w-full h-full" />
          {cameraStatus === "error" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center text-white">
                <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Camera not available</p>
              </div>
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
              <Select value={selectedCamera} onValueChange={setSelectedCamera}>
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
              <Select value={selectedMicrophone} onValueChange={setSelectedMicrophone}>
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
              <Select value={selectedSpeaker} onValueChange={setSelectedSpeaker}>
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
            onClick={onComplete}
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
