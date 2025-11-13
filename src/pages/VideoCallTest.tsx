import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AgoraRTC from "agora-rtc-sdk-ng";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useVideoDevices } from "@/hooks/video/useVideoDevices";
import { DeviceSelector } from "@/components/video/precall/DeviceSelector";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Video,
  Mic,
  Wifi,
  Monitor,
  Loader2,
  ChevronRight,
  Volume2,
} from "lucide-react";

type TestStatus = "pending" | "testing" | "passed" | "failed" | "warning";

interface TestResult {
  status: TestStatus;
  message: string;
  details?: string;
}

export default function VideoCallTest() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLDivElement>(null);
  const localTrackRef = useRef<any>(null);
  const audioTrackRef = useRef<any>(null);
  const testAudioRef = useRef<HTMLAudioElement | null>(null);

  const devices = useVideoDevices();

  const [currentStep, setCurrentStep] = useState(0);
  const [cameraTest, setCameraTest] = useState<TestResult>({ status: "pending", message: "" });
  const [micTest, setMicTest] = useState<TestResult>({ status: "pending", message: "" });
  const [networkTest, setNetworkTest] = useState<TestResult>({ status: "pending", message: "" });
  const [browserTest, setBrowserTest] = useState<TestResult>({ status: "pending", message: "" });
  const [speakerTest, setSpeakerTest] = useState<TestResult>({ status: "pending", message: "" });
  const [audioLevel, setAudioLevel] = useState(0);
  const [networkSpeed, setNetworkSpeed] = useState<number | null>(null);
  const [allTestsPassed, setAllTestsPassed] = useState(false);
  const [isPlayingTestSound, setIsPlayingTestSound] = useState(false);

  // ============================================================================
  // BROWSER COMPATIBILITY TEST
  // ============================================================================
  const testBrowser = async () => {
    setBrowserTest({ status: "testing", message: "Checking browser compatibility..." });

    try {
      const isCompatible = AgoraRTC.checkSystemRequirements();
      const browserInfo = await AgoraRTC.getSupportedCodec();

      if (!isCompatible) {
        setBrowserTest({
          status: "failed",
          message: "Browser not supported",
          details: "Your browser doesn't support WebRTC. Please use Chrome, Firefox, Safari, or Edge.",
        });
        return false;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setBrowserTest({
          status: "failed",
          message: "Media devices not available",
          details: "Your browser cannot access camera and microphone.",
        });
        return false;
      }

      setBrowserTest({
        status: "passed",
        message: "Browser compatible",
        details: `VP8: ${browserInfo.video.some(c => c === 'vp8') ? '✓' : '✗'}, H264: ${browserInfo.video.some(c => c === 'h264') ? '✓' : '✗'}`,
      });
      return true;
    } catch (error) {
      setBrowserTest({
        status: "failed",
        message: "Browser check failed",
        details: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  };

  // ============================================================================
  // CAMERA TEST
  // ============================================================================
  const testCamera = async () => {
    setCameraTest({ status: "testing", message: "Testing camera..." });

    try {
      // Request camera permission and create track
      localTrackRef.current = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: { width: 640, height: 480 },
      });

      // Play video in the preview element
      if (videoRef.current) {
        localTrackRef.current.play(videoRef.current);
      }

      const devices = await AgoraRTC.getCameras();
      setCameraTest({
        status: "passed",
        message: "Camera working",
        details: `Found ${devices.length} camera(s)`,
      });
      return true;
    } catch (error: any) {
      let message = "Camera access failed";
      let details = "";

      if (error.name === "NotAllowedError" || error.code === "PERMISSION_DENIED") {
        details = "Camera permission denied. Please allow camera access in your browser settings.";
      } else if (error.name === "NotFoundError" || error.code === "NO_DEVICE_FOUND") {
        details = "No camera found. Please connect a camera device.";
      } else if (error.name === "NotReadableError") {
        details = "Camera is already in use by another application.";
      } else {
        details = error.message || "Unknown error occurred";
      }

      setCameraTest({ status: "failed", message, details });
      return false;
    }
  };

  // ============================================================================
  // MICROPHONE TEST
  // ============================================================================
  const testMicrophone = async () => {
    setMicTest({ status: "testing", message: "Testing microphone..." });

    try {
      // Create audio track
      audioTrackRef.current = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: "speech_standard",
      });

      // Monitor audio levels
      const interval = setInterval(() => {
        if (audioTrackRef.current) {
          const level = audioTrackRef.current.getVolumeLevel();
          setAudioLevel(Math.floor(level * 100));
        }
      }, 100);

      // Wait for audio detection
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          clearInterval(interval);
          resolve();
        }, 3000);

        const checkLevel = setInterval(() => {
          if (audioTrackRef.current) {
            const level = audioTrackRef.current.getVolumeLevel();
            if (level > 0.1) {
              clearInterval(checkLevel);
              clearTimeout(timeout);
              clearInterval(interval);
              resolve();
            }
          }
        }, 100);
      });

      const devices = await AgoraRTC.getMicrophones();
      setMicTest({
        status: "passed",
        message: "Microphone working",
        details: `Found ${devices.length} microphone(s)`,
      });
      return true;
    } catch (error: any) {
      let message = "Microphone access failed";
      let details = "";

      if (error.name === "NotAllowedError") {
        details = "Microphone permission denied. Please allow microphone access.";
      } else if (error.name === "NotFoundError") {
        details = "No microphone found. Please connect a microphone.";
      } else {
        details = error.message || "Unknown error occurred";
      }

      setMicTest({ status: "failed", message, details });
      return false;
    }
  };

  // ============================================================================
  // NETWORK TEST
  // ============================================================================
  const testNetwork = async () => {
    setNetworkTest({ status: "testing", message: "Testing network connection..." });

    try {
      const startTime = performance.now();
      
      // Test connection to Supabase (as a proxy for network quality)
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/`, {
        method: 'HEAD',
      });
      
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      setNetworkSpeed(latency);

      if (!response.ok && response.status !== 401) {
        throw new Error("Network unreachable");
      }

      if (latency > 300) {
        setNetworkTest({
          status: "warning",
          message: "Network connection slow",
          details: `Latency: ${latency}ms (recommended: <100ms)`,
        });
      } else if (latency > 150) {
        setNetworkTest({
          status: "passed",
          message: "Network connection acceptable",
          details: `Latency: ${latency}ms`,
        });
      } else {
        setNetworkTest({
          status: "passed",
          message: "Network connection excellent",
          details: `Latency: ${latency}ms`,
        });
      }
      return true;
    } catch (error) {
      setNetworkTest({
        status: "failed",
        message: "Network test failed",
        details: "Unable to reach server. Check your internet connection.",
      });
      return false;
    }
  };

  // ============================================================================
  // RUN ALL TESTS
  // ============================================================================
  const runTests = async () => {
    setCurrentStep(1);
    const browserOk = await testBrowser();
    if (!browserOk) return;

    setCurrentStep(2);
    await new Promise(resolve => setTimeout(resolve, 500));
    const cameraOk = await testCamera();

    setCurrentStep(3);
    await new Promise(resolve => setTimeout(resolve, 500));
    const micOk = await testMicrophone();

    setCurrentStep(4);
    await new Promise(resolve => setTimeout(resolve, 500));
    const networkOk = await testNetwork();

    setCurrentStep(5);

    // Check if all critical tests passed
    const allPassed = browserOk && cameraOk && micOk && networkOk;
    setAllTestsPassed(allPassed);
  };

  // ============================================================================
  // SPEAKER TEST
  // ============================================================================
  const testSpeaker = () => {
    setSpeakerTest({ status: "testing", message: "Playing test sound..." });
    setIsPlayingTestSound(true);

    // Create test audio element
    if (!testAudioRef.current) {
      testAudioRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYHGGS66+OcTgwPUKXh8bllHQU2jdXyzn0vBSJ1xe/glEILElyx6OyrWBUIQ5zd8sFuIwUte8vv2oo5BxdluOrhmU8MDEui3+26aB8GM4zS8tGBMAYgccPu3Y9DCxFYrebo7a1eFwdBmdryu3AiBSl7yO3ajj8HE2S25+Gbk");
    }

    testAudioRef.current.play()
      .then(() => {
        setSpeakerTest({
          status: "passed",
          message: "Speaker working",
          details: "If you heard the sound, your speakers are working correctly",
        });
      })
      .catch((error) => {
        setSpeakerTest({
          status: "failed",
          message: "Speaker test failed",
          details: error.message,
        });
      })
      .finally(() => {
        setIsPlayingTestSound(false);
      });
  };

  // ============================================================================
  // SAVE PREFERENCES
  // ============================================================================
  const savePreferences = () => {
    if (devices.selectedCamera) {
      localStorage.setItem("preferred-camera", devices.selectedCamera);
    }
    if (devices.selectedMicrophone) {
      localStorage.setItem("preferred-microphone", devices.selectedMicrophone);
    }
    if (devices.selectedSpeaker) {
      localStorage.setItem("preferred-speaker", devices.selectedSpeaker);
    }
    console.log("[VideoCallTest] Preferences saved");
  };

  // ============================================================================
  // AUTO-RETURN LOGIC
  // ============================================================================
  useEffect(() => {
    if (allTestsPassed) {
      savePreferences();
      
      const returnUrl = sessionStorage.getItem("video-test-return-url");
      if (returnUrl) {
        console.log("[VideoCallTest] Auto-returning to:", returnUrl);
        setTimeout(() => {
          navigate(returnUrl);
          sessionStorage.removeItem("video-test-return-url");
        }, 2000);
      }
    }
  }, [allTestsPassed, navigate]);

  // ============================================================================
  // REQUEST PERMISSIONS ON MOUNT
  // ============================================================================
  useEffect(() => {
    devices.requestPermissions();
  }, []);

  // ============================================================================
  // CLEANUP
  // ============================================================================
  useEffect(() => {
    return () => {
      if (localTrackRef.current) {
        localTrackRef.current.stop();
        localTrackRef.current.close();
      }
      if (audioTrackRef.current) {
        audioTrackRef.current.stop();
        audioTrackRef.current.close();
      }
      if (testAudioRef.current) {
        testAudioRef.current.pause();
        testAudioRef.current = null;
      }
    };
  }, []);

  // ============================================================================
  // RENDER STATUS ICON
  // ============================================================================
  const StatusIcon = ({ status }: { status: TestStatus }) => {
    switch (status) {
      case "passed":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-destructive" />;
      case "warning":
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case "testing":
        return <Loader2 className="w-5 h-5 animate-spin text-primary" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-muted" />;
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Video Call Test</h1>
          <p className="text-muted-foreground">
            Check your camera, microphone, and network quality before joining
          </p>
        </div>

        {/* Progress */}
        {currentStep > 0 && currentStep < 5 && (
          <Card className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Testing... {currentStep}/4</span>
                <span>{Math.round((currentStep / 4) * 100)}%</span>
              </div>
              <Progress value={(currentStep / 4) * 100} />
            </div>
          </Card>
        )}

        {/* Device Selection */}
        {devices.hasPermissions && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Device Settings</h2>
            <div className="space-y-4">
              <DeviceSelector
                deviceType="camera"
                devices={devices.cameras}
                selectedDevice={devices.selectedCamera}
                onSelect={devices.selectCamera}
              />
              <DeviceSelector
                deviceType="microphone"
                devices={devices.microphones}
                selectedDevice={devices.selectedMicrophone}
                onSelect={devices.selectMicrophone}
              />
              <DeviceSelector
                deviceType="speaker"
                devices={devices.speakers}
                selectedDevice={devices.selectedSpeaker}
                onSelect={devices.selectSpeaker}
                onTest={testSpeaker}
              />
            </div>
          </Card>
        )}

        {/* Video Preview */}
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Video className="w-5 h-5" />
              <h2 className="text-xl font-semibold">Camera Preview</h2>
            </div>
            <div
              ref={videoRef}
              className="relative bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center"
            >
              {cameraTest.status === "pending" && (
                <p className="text-muted-foreground">Camera preview will appear here</p>
              )}
              {cameraTest.status === "testing" && (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <p>Initializing camera...</p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Microphone Level */}
        {micTest.status === "testing" && (
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Mic className="w-5 h-5" />
                <h2 className="text-xl font-semibold">Microphone Level</h2>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Speak to test your microphone</p>
                <Progress value={audioLevel} />
                <p className="text-xs text-right">{audioLevel}%</p>
              </div>
            </div>
          </Card>
        )}

        {/* Test Results */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Test Results</h2>
          <div className="space-y-4">
            {/* Browser Test */}
            <div className="flex items-start gap-3">
              <StatusIcon status={browserTest.status} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4" />
                    <span className="font-medium">Browser Compatibility</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{browserTest.message}</span>
                </div>
                {browserTest.details && (
                  <p className="text-xs text-muted-foreground mt-1">{browserTest.details}</p>
                )}
              </div>
            </div>

            <Separator />

            {/* Camera Test */}
            <div className="flex items-start gap-3">
              <StatusIcon status={cameraTest.status} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    <span className="font-medium">Camera</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{cameraTest.message}</span>
                </div>
                {cameraTest.details && (
                  <p className="text-xs text-muted-foreground mt-1">{cameraTest.details}</p>
                )}
              </div>
            </div>

            <Separator />

            {/* Microphone Test */}
            <div className="flex items-start gap-3">
              <StatusIcon status={micTest.status} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4" />
                    <span className="font-medium">Microphone</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{micTest.message}</span>
                </div>
                {micTest.details && (
                  <p className="text-xs text-muted-foreground mt-1">{micTest.details}</p>
                )}
              </div>
            </div>

            <Separator />

            {/* Network Test */}
            <div className="flex items-start gap-3">
              <StatusIcon status={networkTest.status} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wifi className="w-4 h-4" />
                    <span className="font-medium">Network Connection</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{networkTest.message}</span>
                </div>
                {networkTest.details && (
                  <p className="text-xs text-muted-foreground mt-1">{networkTest.details}</p>
                )}
              </div>
            </div>

            <Separator />

            {/* Speaker Test */}
            <div className="flex items-start gap-3">
              <StatusIcon status={speakerTest.status} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4" />
                    <span className="font-medium">Speakers</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{speakerTest.message}</span>
                </div>
                {speakerTest.details && (
                  <p className="text-xs text-muted-foreground mt-1">{speakerTest.details}</p>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Results Summary */}
        {currentStep === 5 && (
          <Card className="p-6">
            {allTestsPassed ? (
              <div className="text-center space-y-4">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
                <div>
                  <h3 className="text-xl font-semibold">Ready to Join!</h3>
                  <p className="text-muted-foreground">
                    All tests passed. Your device is ready for video calls.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto" />
                <div>
                  <h3 className="text-xl font-semibold">Some Tests Failed</h3>
                  <p className="text-muted-foreground">
                    Please fix the issues above before joining a video call.
                  </p>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-center gap-4">
          {currentStep === 0 ? (
            <Button onClick={runTests} size="lg" className="gap-2">
              Start Test
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : currentStep === 5 ? (
            <>
              <Button variant="outline" onClick={() => window.location.reload()} size="lg">
                Run Tests Again
              </Button>
              {allTestsPassed && (
                <Button onClick={() => navigate(-1)} size="lg" className="gap-2">
                  Continue to Video Call
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </>
          ) : (
            <Button disabled size="lg">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Testing...
            </Button>
          )}
        </div>

        {/* Help Text */}
        <Card className="p-4 bg-muted/50">
          <h3 className="font-semibold mb-2 text-sm">Troubleshooting Tips:</h3>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Make sure your browser has permission to access camera and microphone</li>
            <li>• Close other applications that might be using your camera</li>
            <li>• Use a stable internet connection (Wi-Fi or ethernet recommended)</li>
            <li>• For best results, use Chrome, Firefox, Safari, or Edge</li>
            <li>• Restart your browser if tests continue to fail</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
