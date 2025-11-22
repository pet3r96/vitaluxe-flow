// Agora Credentials Debug Panel - Fresh build trigger
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Copy, RefreshCw } from "lucide-react";

interface BackendData {
  backendAppId: string;
  backendCertFirst4: string;
  backendCertLast4: string;
  backendCertLength: number;
  serverTime: number;
  timestamp: string;
}

interface FrontendData {
  appId: string;
  rtcToken: string;
  rtmToken: string;
  uid: string;
  channel?: string;
  expiresAt: string;
}

export default function AgoraCredentialsDebug() {
  const [backendData, setBackendData] = useState<BackendData | null>(null);
  const [frontendData, setFrontendData] = useState<FrontendData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    console.log("🔷 AGORA DEBUG PANEL LOADED");
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    console.log("🔄 Fetching all Agora credentials...");
    
    await Promise.all([
      fetchBackendCredentials(),
      fetchFrontendCredentials()
    ]);
    
    setLoading(false);
  };

  const fetchBackendCredentials = async () => {
    try {
      console.log("🔵 Fetching BACKEND credentials...");
      const { data, error } = await supabase.functions.invoke('agora-diagnostics', {
        body: { action: 'credentials' }
      });

      if (error) throw error;

      console.log("🔵 BACKEND APP ID:", data.data.backendAppId);
      console.log("🔵 BACKEND APP ID LENGTH:", data.data.backendAppId.length);
      console.log("🔵 BACKEND CERT:", `${data.data.backendCertFirst4}...${data.data.backendCertLast4}`);
      console.log("🔵 BACKEND CERT LENGTH:", data.data.backendCertLength);
      console.log("🔵 BACKEND SERVER TIME:", new Date(data.data.serverTime).toISOString());

      setBackendData(data.data);
    } catch (err: any) {
      console.error("❌ Backend fetch error:", err);
      setError(prev => prev ? `${prev}\nBackend error: ${err.message}` : `Backend error: ${err.message}`);
    }
  };

  const fetchFrontendCredentials = async () => {
    try {
      console.log("🔴 Fetching FRONTEND credentials...");
      const testChannel = `debug-${Date.now()}`;
      const testUid = `debug-${Math.random().toString(36).substring(7)}`;

      const { data, error } = await supabase.functions.invoke('agora-token', {
        body: {
          channel: testChannel,
          uid: testUid,
          role: 'publisher'
        }
      });

      if (error) throw error;

      console.log("🔴 FRONTEND APP ID:", data.appId);
      console.log("🔴 FRONTEND APP ID LENGTH:", data.appId.length);
      console.log("🔴 FRONTEND FIRST 6 CHARS:", data.appId.substring(0, 6));
      console.log("🔴 FRONTEND LAST 6 CHARS:", data.appId.substring(data.appId.length - 6));
      console.log("🔴 FRONTEND CHANNEL:", testChannel);
      console.log("🔴 FRONTEND UID:", testUid);
      console.log("🔴 FRONTEND RTC TOKEN:", `${data.rtcToken.substring(0, 6)}...${data.rtcToken.substring(data.rtcToken.length - 6)}`);
      console.log("🔴 FRONTEND RTM TOKEN:", `${data.rtmToken.substring(0, 6)}...${data.rtmToken.substring(data.rtmToken.length - 6)}`);

      setFrontendData({ ...data, channel: testChannel });
    } catch (err: any) {
      console.error("❌ Frontend fetch error:", err);
      setError(prev => prev ? `${prev}\nFrontend error: ${err.message}` : `Frontend error: ${err.message}`);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  const matchStatus = backendData && frontendData 
    ? backendData.backendAppId === frontendData.appId
    : null;

  useEffect(() => {
    if (matchStatus !== null) {
      console.log("🟢 MATCH STATUS:", matchStatus ? "✓ MATCH" : "✗ MISMATCH");
      if (backendData && frontendData) {
        console.log("   Backend:", backendData.backendAppId);
        console.log("   Frontend:", frontendData.appId);
      }
    }
  }, [matchStatus, backendData, frontendData]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agora Credentials Debug</h1>
          <p className="text-muted-foreground mt-1">
            Direct comparison of backend and frontend Agora credentials
          </p>
        </div>
        <Button onClick={fetchAllData} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive font-mono text-sm whitespace-pre-wrap">{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Backend Credentials */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🔵 Backend Credentials
            </CardTitle>
            <CardDescription>
              Values from agora-diagnostics edge function
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {backendData ? (
              <>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">backend_app_id</div>
                  <div className="font-mono text-lg bg-muted p-3 rounded flex items-center justify-between">
                    <span className="break-all">{backendData.backendAppId}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(backendData.backendAppId, "Backend App ID")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-muted-foreground mb-1">backend_app_id_length</div>
                  <div className="font-mono text-lg bg-muted p-3 rounded">
                    {backendData.backendAppId.length}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">backend_cert_first_4</div>
                    <div className="font-mono text-lg bg-muted p-3 rounded">
                      {backendData.backendCertFirst4}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">backend_cert_last_4</div>
                    <div className="font-mono text-lg bg-muted p-3 rounded">
                      {backendData.backendCertLast4}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-muted-foreground mb-1">backend_cert_length</div>
                  <div className="font-mono text-lg bg-muted p-3 rounded">
                    {backendData.backendCertLength}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-muted-foreground mb-1">server_time</div>
                  <div className="font-mono text-sm bg-muted p-3 rounded">
                    {new Date(backendData.serverTime).toISOString()}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                {loading ? "Loading..." : "No data"}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Frontend Credentials */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🔴 Frontend Credentials
            </CardTitle>
            <CardDescription>
              Values from agora-token edge function
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {frontendData ? (
              <>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">frontend_app_id</div>
                  <div className="font-mono text-lg bg-muted p-3 rounded flex items-center justify-between">
                    <span className="break-all">{frontendData.appId}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(frontendData.appId, "Frontend App ID")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-muted-foreground mb-1">frontend_app_id_length</div>
                  <div className="font-mono text-lg bg-muted p-3 rounded">
                    {frontendData.appId.length}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">frontend_first_6_chars</div>
                    <div className="font-mono text-lg bg-muted p-3 rounded">
                      {frontendData.appId.substring(0, 6)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">frontend_last_6_chars</div>
                    <div className="font-mono text-lg bg-muted p-3 rounded">
                      {frontendData.appId.substring(frontendData.appId.length - 6)}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-muted-foreground mb-1">channel</div>
                  <div className="font-mono text-sm bg-muted p-3 rounded break-all">
                    {frontendData.channel}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-muted-foreground mb-1">uid</div>
                  <div className="font-mono text-sm bg-muted p-3 rounded break-all">
                    {frontendData.uid}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-muted-foreground mb-1">rtc_token (masked)</div>
                  <div className="font-mono text-sm bg-muted p-3 rounded break-all">
                    {frontendData.rtcToken.substring(0, 6)}...{frontendData.rtcToken.substring(frontendData.rtcToken.length - 6)}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-muted-foreground mb-1">rtm_token (masked)</div>
                  <div className="font-mono text-sm bg-muted p-3 rounded break-all">
                    {frontendData.rtmToken.substring(0, 6)}...{frontendData.rtmToken.substring(frontendData.rtmToken.length - 6)}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                {loading ? "Loading..." : "No data"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Comparison Section */}
      {matchStatus !== null && (
        <Card className={matchStatus ? "border-green-500" : "border-destructive"}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {matchStatus ? "🟢" : "🔴"} Comparison
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className={`text-2xl font-bold mb-4 ${matchStatus ? "text-green-600" : "text-destructive"}`}>
                {matchStatus ? "✓ App IDs MATCH" : "✗ App IDs MISMATCH"}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center bg-muted p-3 rounded">
                  <span className="text-muted-foreground">Backend:</span>
                  <span className="font-mono">
                    {backendData?.backendAppId.substring(0, 6)}...{backendData?.backendAppId.substring(backendData.backendAppId.length - 6)}
                  </span>
                </div>
                <div className="flex justify-between items-center bg-muted p-3 rounded">
                  <span className="text-muted-foreground">Frontend:</span>
                  <span className="font-mono">
                    {frontendData?.appId.substring(0, 6)}...{frontendData?.appId.substring(frontendData.appId.length - 6)}
                  </span>
                </div>
              </div>

              <div className="mt-4 text-sm text-muted-foreground">
                {matchStatus 
                  ? "Both backend and frontend are using the same Agora App ID" 
                  : "⚠️ Backend and frontend are using DIFFERENT Agora App IDs"}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
