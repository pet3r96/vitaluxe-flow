import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, Mic, Volume2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import AgoraRTC from "agora-rtc-sdk-ng";
import { toast } from "sonner";

interface DeviceTestScreenProps {
  onComplete: () => void;
  appId: string;
}

export const DeviceTestScreen = ({ onComplete, appId }: DeviceTestScreenProps) => {
  const [cameraStatus, setCameraStatus] = useState<"testing" | "success" | "error">("testing");
  const [micStatus, setMicStatus] = useState<"testing" | "success" | "error">("testing");
  const [speakerStatus, setSpeakerStatus] = useState<"testing" | "success" | "error">("testing");
  const [audioLevel, setAudioLevel] = useState(0);
  const [isTestingAudio, setIsTestingAudio] = useState(false);
  
  const videoRef = useRef<HTMLDivElement>(null);
  const localVideoTrackRef = useRef<any>(null);
  const localAudioTrackRef = useRef<any>(null);
  const audioIntervalRef = useRef<any>(null);

  useEffect(() => {
    testDevices();
    return () => {
      cleanup();
    };
  }, []);

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
  };

  const testDevices = async () => {
    // Test Camera
    try {
      const videoTrack = await AgoraRTC.createCameraVideoTrack();
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

    // Test Microphone
    try {
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      localAudioTrackRef.current = audioTrack;
      setMicStatus("success");

      // Monitor audio levels
      audioIntervalRef.current = setInterval(() => {
        const level = audioTrack.getVolumeLevel();
        setAudioLevel(level);
      }, 100);
    } catch (error) {
      console.error("Microphone test failed:", error);
      setMicStatus("error");
      toast.error("Microphone access denied. Please allow microphone permissions.");
    }

    // Speakers are assumed working (can't reliably test without user interaction)
    setSpeakerStatus("success");
  };

  const testSpeakers = () => {
    setIsTestingAudio(true);
    const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuFzvLZiTYIHm3A7+OZTA4NVqzn77BfGAg+ltryy3krBSl+zPLaizsKGGW3692dTA8MW6/o7q1aFgxKouHxwWceBjON0/LPeTEHKoPO8tqJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuFzvLZiTYIHm3A7+OZTA4NVqzn77BfGAg+ltryy3krBSl+zPLaizsKGGW3692dTA8MW6/o7q1aFgxKouHxwWceBjON0/LPeTEHKoPO8tqJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuFzvLZiTYIHm3A7+OZTA4NVqzn77BfGAg+ltryy3krBSl+zPLaizsKGGW3692dTA8MW6/o7q1aFgxKouHxwWceBjON0/LPeTEHKoPO8tqJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuFzvLZiTYIHm3A7+OZTA4NVqzn77BfGAg+ltryy3krBSl+zPLaizsKGGW3692dTA8MW6/o7q1aFgxKouHxwWceBjON0/LPeTEHKoPO8tqJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuFzvLZiTYIHm3A7+OZTA4NVqzn77BfGAg+ltryy3krBSl+zPLaizsKGGW3692dTA8MW6/o7q1aFgxKouHxwWceBjON0/LPeTEHKoPO8tqJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuFzvLZiTYIHm3A7+OZTA4NVqzn77BfGAg+ltryy3krBSl+zPLaizsKGGW3692dTA8MW6/o7q1aFgxKouHxwWceBjON0/LPeTEHKoPO8tqJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuFzvLZiTYIHm3A7+OZTA4NVqzn77BfGAg+ltryy3krBSl+zPLaizsKGGW3692dTA8MW6/o7q1aFgxKouHxwWceBjON0/LPeTEHKoPO8tqJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuFzvLZiTYIHm3A7+OZTA4NVqzn77BfGAg+ltryy3krBSl+zPLaizsKGGW3692dTA8MW6/o7q1aFgxKouHxwWceBjON0/LPeTEHKoPO8tqJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFA==");
    audio.play();
    setTimeout(() => {
      setIsTestingAudio(false);
    }, 1000);
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
        <div>
          <h2 className="text-2xl font-bold text-foreground">Device Check</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Please allow camera and microphone access to join the video session
          </p>
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
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Camera className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">Camera</span>
            </div>
            {getStatusIcon(cameraStatus)}
          </div>

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
