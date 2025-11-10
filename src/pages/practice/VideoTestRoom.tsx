import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import AgoraRTC, { IAgoraRTCClient } from "agora-rtc-sdk-ng";
import { CredentialValidator } from "@/components/video/CredentialValidator";

export default function VideoTestRoom() {
  const { toast } = useToast();
  const [appId, setAppId] = useState("");
  const [channelName, setChannelName] = useState("vitaluxe test");
  const [token, setToken] = useState("");
  const [uid, setUid] = useState("0");
  const [isJoining, setIsJoining] = useState(false);
  const [client, setClient] = useState<IAgoraRTCClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [skipRTM, setSkipRTM] = useState(false);

  const handleJoin = async () => {
    if (!appId.trim() || !token.trim()) {
      toast({
        title: "Missing Fields",
        description: "Please provide App ID and Token",
        variant: "destructive",
      });
      return;
    }

    setIsJoining(true);

    try {
      console.group("🧪 TEST ROOM - Join Attempt");
      console.log("App ID:", appId.substring(0, 8) + "...");
      console.log("Channel:", channelName);
      console.log("UID:", uid);
      console.log("Token Preview:", token.substring(0, 30) + "...");
      console.groupEnd();

      // Enable detailed Agora logging
      AgoraRTC.setLogLevel(4);

      const agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      
      agoraClient.on("connection-state-change", (curState, revState, reason) => {
        console.log("🔄 Connection state:", curState, "Reason:", reason);
      });

      agoraClient.on("user-published", async (user, mediaType) => {
        console.log("👤 User published:", user.uid, mediaType);
        await agoraClient.subscribe(user, mediaType);
        if (mediaType === "video") {
          user.videoTrack?.play(`remote-player-${user.uid}`);
        }
        if (mediaType === "audio") {
          user.audioTrack?.play();
        }
      });

      // Join channel
      await agoraClient.join(appId, channelName, token, uid);
      console.log("✅ Successfully joined channel!");

      // Create and publish local tracks
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      const videoTrack = await AgoraRTC.createCameraVideoTrack();

      await agoraClient.publish([audioTrack, videoTrack]);
      videoTrack.play("local-test-player");

      setClient(agoraClient);
      setIsConnected(true);

      toast({
        title: "✅ Connected Successfully",
        description: `Joined channel: ${channelName}`,
      });
    } catch (error: any) {
      console.group("❌ TEST ROOM - Join Failed");
      console.error("Error:", error);
      console.log("Code:", error.code);
      console.log("Message:", error.message);
      console.log("Name:", error.name);
      console.groupEnd();

      let errorMsg = error.message || "Unknown error";
      if (error.code === "INVALID_VENDOR_KEY") {
        errorMsg = "Invalid App ID";
      } else if (error.code === "INVALID_TOKEN") {
        errorMsg = "Invalid or expired token";
      } else if (error.code === "CAN_NOT_GET_GATEWAY_SERVER") {
        errorMsg = "Cannot connect to Agora gateway. Check App ID/Certificate match.";
      }

      toast({
        title: "❌ Join Failed",
        description: `${error.code}: ${errorMsg}`,
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeave = async () => {
    if (client) {
      await client.leave();
      client.removeAllListeners();
      setClient(null);
      setIsConnected(false);
      toast({
        title: "Disconnected",
        description: "Left the test channel",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card className="p-6">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">🧪 Agora Video Test Room</h1>
            <p className="text-muted-foreground">
              Use this to test with a temporary token from Agora Console
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="appId">App ID (32 hex characters)</Label>
              <Input
                id="appId"
                placeholder="e.g. 1234567890abcdef1234567890abcdef"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                disabled={isConnected}
              />
            </div>

            <div>
              <Label htmlFor="channelName">Channel Name</Label>
              <Input
                id="channelName"
                placeholder="vitaluxe test"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                disabled={isConnected}
              />
            </div>

            <div>
              <Label htmlFor="token">Temporary Token (from Agora Console)</Label>
              <Input
                id="token"
                placeholder="Paste token here..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={isConnected}
              />
            </div>

            <div>
              <Label htmlFor="uid">UID (use 0 for auto-assign)</Label>
              <Input
                id="uid"
                placeholder="0"
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                disabled={isConnected}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="skip-rtm"
                checked={skipRTM}
                onCheckedChange={setSkipRTM}
                disabled={isConnected}
              />
              <Label htmlFor="skip-rtm">
                Skip RTM (Chat Off) - For testing RTC only
              </Label>
            </div>
          </div>

          {appId && token && (
            <CredentialValidator
              appId={appId}
              token={token}
            />
          )}

          <div className="flex gap-4">
            {!isConnected ? (
              <Button onClick={handleJoin} disabled={isJoining}>
                {isJoining ? "Joining..." : "Join Test Channel"}
              </Button>
            ) : (
              <Button onClick={handleLeave} variant="destructive">
                Leave Channel
              </Button>
            )}
          </div>

          {isConnected && (
            <div className="mt-8 space-y-4">
              <h2 className="text-xl font-semibold">✅ Connected - Video Preview</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium mb-2">Your Video</p>
                  <div
                    id="local-test-player"
                    className="bg-black aspect-video rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 p-4 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2">📋 How to use:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Go to your Agora Console</li>
              <li>Generate a temp token for channel "vitaluxe test"</li>
              <li>Copy your App ID and the temp token</li>
              <li>Paste them above and click "Join Test Channel"</li>
              <li>Check browser console for detailed logs</li>
            </ol>
          </div>
        </div>
      </Card>
    </div>
  );
}
