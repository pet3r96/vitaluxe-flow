import { useState } from "react";
import { useAgoraCall } from "@/hooks/useAgoraCall";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function QuickAgoraTest() {
  const [channel, setChannel] = useState("demo");
  const [userId, setUserId] = useState("tester_1");
  const [isConfigured, setIsConfigured] = useState(false);

  const call = useAgoraCall({
    channel: isConfigured ? channel : "",
    userId: isConfigured ? userId : "",
  });

  const handleJoin = () => {
    if (!channel || !userId) {
      alert("Please enter both channel and user ID");
      return;
    }
    setIsConfigured(true);
    call.join();
  };

  const handleLeave = () => {
    call.leave();
    setIsConfigured(false);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">🧪 Quick Agora Test</h1>
          <p className="text-muted-foreground">Dev-only page to verify 1:1 video hook</p>
        </div>

        <Card className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Channel Name</label>
              <Input
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="demo"
                disabled={isConfigured}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">User ID</label>
              <Input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="tester_1"
                disabled={isConfigured}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleJoin}
              disabled={isConfigured || !channel || !userId}
              className="flex-1"
            >
              Join
            </Button>
            <Button
              onClick={handleLeave}
              disabled={!isConfigured}
              variant="destructive"
              className="flex-1"
            >
              Leave
            </Button>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${call.isJoined ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span>{call.isJoined ? 'Connected' : 'Disconnected'}</span>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <h2 className="text-sm font-medium mb-2">Local Video (You)</h2>
            <div
              ref={call.localVideoRef}
              className="w-full h-[400px] bg-black rounded-lg"
            />
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-medium mb-2">Remote Video</h2>
            <div
              ref={call.remoteVideoRef}
              className="w-full h-[400px] bg-black rounded-lg"
            />
          </Card>
        </div>

        <Card className="p-4 bg-muted">
          <h3 className="font-medium mb-2">📝 Test Instructions</h3>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>1. Open this page in two different browsers/tabs</li>
            <li>2. Use the same channel name (e.g., "demo")</li>
            <li>3. Use different user IDs (e.g., "tester_1" and "tester_2")</li>
            <li>4. Click Join in both - you should see each other</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
