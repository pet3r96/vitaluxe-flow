// 🧹 TODO AGORA REFACTOR
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
// import AgoraRTC, { IAgoraRTCClient } from "agora-rtc-sdk-ng";
import { Loader2 } from "lucide-react";

export default function TokenVerificationTest() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [tokenData, setTokenData] = useState<any>(null);
  const [client, setClient] = useState<IAgoraRTCClient | null>(null);
  
  // Test parameters
  const [channelName, setChannelName] = useState("vlx-debug");
  const [uid, setUid] = useState("debug-user-1");
  const [role, setRole] = useState<"publisher" | "subscriber">("publisher");

  // Manual hardcoded token inputs (no mutation!)
  const [manualAppId, setManualAppId] = useState("2443c37d5f97424c8b7e1c08e3a3032e");
  const [manualChannel, setManualChannel] = useState("vlx-debug");
  const [manualUid, setManualUid] = useState("debug-user-1");
  const [manualRtcToken, setManualRtcToken] = useState("");

  const fetchBackendToken = async () => {
    setLoading(true);
    try {
      console.log("🔧 [TOKEN-TEST] Fetching token from backend...");
      console.log("Parameters:", { channelName, uid, role, expiresInSeconds: 3600 });
      
      const { data, error } = await supabase.functions.invoke('test-agora-token', {
        body: {
          channelName,
          uid,
          role,
          expiresInSeconds: 3600
        }
      });

      if (error) {
        console.error("❌ [TOKEN-TEST] Failed to fetch token:", error);
        throw error;
      }

      console.log("✅ [TOKEN-TEST] Backend token received");
      console.log("=== BACKEND TOKEN DATA ===");
      console.log("[BE] appId:", data.appId);
      console.log("[BE] channelName:", data.channelName);
      console.log("[BE] uid:", data.uid);
      console.log("[BE] rtcToken.length:", data.rtcToken.length);
      console.log("[BE] rtcToken.prefix:", data.rtcToken.slice(0, 20));
      console.log("[BE] rtcToken starts with 007:", data.rtcToken.startsWith("007"));
      console.log("[BE] rtmToken.length:", data.rtmToken.length);
      console.log("[BE] rtmToken.prefix:", data.rtmToken.slice(0, 20));
      console.log("[BE] rtmToken starts with 007:", data.rtmToken.startsWith("007"));
      console.log("========================");

      setTokenData(data);
      
      toast({
        title: "Token Fetched",
        description: "Backend token retrieved successfully. Check console for details.",
      });
    } catch (error: any) {
      console.error("❌ [TOKEN-TEST] Error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch token",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const testJoinWithBackendToken = async () => {
    if (!tokenData) {
      toast({
        title: "No Token",
        description: "Please fetch a backend token first",
        variant: "destructive",
      });
      return;
    }

    setJoining(true);
    try {
      // Create Agora client
      const agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      
      // CRITICAL: Use EXACT values from backend
      const appId = tokenData.appId;
      const channel = tokenData.channelName;
      const token = tokenData.rtcToken;
      const joinUid = tokenData.uid; // Use exact UID from backend
      
      console.log("🔧 [TOKEN-TEST] Testing join with backend token...");
      console.log("=== FRONTEND JOIN PARAMETERS ===");
      console.log("[FE] appId:", appId);
      console.log("[FE] channel:", channel);
      console.log("[FE] uid:", joinUid);
      console.log("[FE] rtcToken.length:", token.length);
      console.log("[FE] rtcToken.prefix:", token.slice(0, 20));
      console.log("[FE] rtcToken starts with 007:", token.startsWith("007"));
      console.log("================================");
      
      // Verify NO mutation happened
      console.log("🔍 [TOKEN-TEST] Mutation Check:");
      console.log("  Token length matches:", token.length === tokenData.rtcToken.length);
      console.log("  Token prefix matches:", token.slice(0, 20) === tokenData.rtcToken.slice(0, 20));
      console.log("  Token is identical:", token === tokenData.rtcToken);
      console.log("  UID type:", typeof joinUid);
      console.log("  UID matches:", joinUid === tokenData.uid);
      
      // Join with EXACT backend token
      await agoraClient.join(appId, channel, token, joinUid);
      
      console.log("✅ [TOKEN-TEST] Successfully joined with backend token!");
      
      setClient(agoraClient);
      
      toast({
        title: "Join Successful!",
        description: "Backend token works correctly. Check console for verification.",
      });
    } catch (error: any) {
      console.error("❌ [TOKEN-TEST] Join failed:", error);
      console.error("Error details:", {
        code: error.code,
        message: error.message,
        name: error.name,
      });
      
      toast({
        title: "Join Failed",
        description: `${error.code}: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setJoining(false);
    }
  };

  const testJoinWithManualToken = async () => {
    if (!manualRtcToken) {
      toast({
        title: "Paste RTC Token",
        description: "Paste the rtcToken from /test-agora-token",
        variant: "destructive",
      });
      return;
    }

    setJoining(true);
    try {
      const agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

      const appId = manualAppId; // EXACT appId
      const channel = manualChannel; // EXACT channel
      const rtcToken = manualRtcToken; // EXACT token pasted
      const joinUid = manualUid; // EXACT uid used in token generation

      console.log("=== FE HARD-CODED TOKEN TEST ===");
      console.log("[FE TEST] rtcToken prefix:", rtcToken.slice(0, 30));
      console.log("[FE TEST] rtcToken length:", rtcToken.length);
      console.log("[FE TEST] starts with 007:", rtcToken.startsWith("007"));
      console.log("[FE TEST] appId:", appId);
      console.log("[FE TEST] channel:", channel);
      console.log("[FE TEST] uid:", joinUid);
      console.log("================================");

      await agoraClient.join(appId, channel, rtcToken, joinUid);
      console.log("✅ [FE TEST] Joined successfully with pasted backend token");
      setClient(agoraClient);
      toast({ title: "Join Successful!", description: "Hardcoded token join worked." });
    } catch (error: any) {
      console.error("❌ [FE TEST] Join failed:", error);
      toast({ title: "Join Failed", description: `${error.code}: ${error.message}`, variant: "destructive" });
    } finally {
      setJoining(false);
    }
  };

  const leaveChannel = async () => {
    if (client) {
      await client.leave();
      setClient(null);
      toast({
        title: "Left Channel",
        description: "Disconnected from Agora",
      });
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Card className="p-6">
        <h1 className="text-2xl font-bold mb-6">Agora Token Verification Test</h1>
        
        <div className="space-y-4 mb-6">
          <div>
            <Label htmlFor="channelName">Channel Name</Label>
            <Input
              id="channelName"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="vlx-debug"
            />
          </div>
          
          <div>
            <Label htmlFor="uid">User ID (string)</Label>
            <Input
              id="uid"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              placeholder="debug-user-1"
            />
          </div>
          
          <div>
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as "publisher" | "subscriber")}
              className="w-full border rounded px-3 py-2"
            >
              <option value="publisher">Publisher</option>
              <option value="subscriber">Subscriber</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          <Button
            onClick={fetchBackendToken}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Fetching Backend Token...
              </>
            ) : (
              "1. Fetch Backend Token"
            )}
          </Button>

          {tokenData && (
            <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
              <h3 className="font-semibold">Backend Token Data:</h3>
              <div className="space-y-1 font-mono">
                <p>App ID: {tokenData.appId}</p>
                <p>Channel: {tokenData.channelName}</p>
                <p>UID: {tokenData.uid}</p>
                <p>RTC Token Length: {tokenData.rtcToken.length}</p>
                <p>RTC Token Prefix: {tokenData.rtcToken.slice(0, 20)}...</p>
                <p>Starts with 007: {tokenData.rtcToken.startsWith("007") ? "✅" : "❌"}</p>
                <p className="text-xs mt-2 text-muted-foreground">
                  RTM Token Length: {tokenData.rtmToken.length}
                </p>
              </div>
            </div>
          )}

          <Button
            onClick={testJoinWithBackendToken}
            disabled={!tokenData || joining || !!client}
            className="w-full"
            variant="default"
          >
            {joining ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                2. Test Join with Backend Token
              </>
            ) : (
              "2. Test Join with Backend Token"
            )}
          </Button>

          <div className="mt-8 space-y-3">
            <h3 className="font-semibold">Manual Hardcoded Token Test</h3>
            <p className="text-sm text-muted-foreground">Paste the exact rtcToken from /test-agora-token. We will use it verbatim without any transformation.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>App ID</Label>
                <Input value={manualAppId} onChange={(e) => setManualAppId(e.target.value)} />
              </div>
              <div>
                <Label>Channel</Label>
                <Input value={manualChannel} onChange={(e) => setManualChannel(e.target.value)} />
              </div>
              <div>
                <Label>UID (string)</Label>
                <Input value={manualUid} onChange={(e) => setManualUid(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>RTC Token (paste exactly)</Label>
                <textarea
                  className="w-full border rounded px-3 py-2 font-mono text-sm"
                  rows={4}
                  value={manualRtcToken}
                  onChange={(e) => setManualRtcToken(e.target.value)}
                  placeholder="007..."
                />
              </div>
            </div>
            <Button onClick={testJoinWithManualToken} disabled={joining || !!client} className="w-full">
              {joining ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  3. Join with MANUAL rtcToken
                </>
              ) : (
                "3. Join with MANUAL rtcToken"
              )}
            </Button>
          </div>

          {client && (
            <Button
              onClick={leaveChannel}
              variant="secondary"
              className="w-full"
            >
              Leave Channel
            </Button>
          )}
        </div>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <h3 className="font-semibold mb-2">Instructions:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Click "Fetch Backend Token" to get a token from /test-agora-token</li>
            <li>Check the console logs to see backend token details</li>
            <li>Click "Test Join" to join Agora with the EXACT backend token</li>
            <li>Alternatively, paste the rtcToken into the manual section and join</li>
            <li>Compare [BE] and [FE] logs - they MUST be identical</li>
            <li>If join fails, check for token mutation or parameter mismatch</li>
          </ol>
        </div>
      </Card>
    </div>
  );
}
