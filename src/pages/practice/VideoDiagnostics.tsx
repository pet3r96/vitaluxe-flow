import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAgoraCore } from "@/hooks/video/useAgoraCore";
import { AlertCircle, CheckCircle, Loader2, Copy, Play } from "lucide-react";

interface BackendCredentials {
  backendAppId: string;
  backendCertFirst4: string;
  backendCertLast4: string;
  backendCertLength: number;
  serverTime: number;
  timestamp: string;
}

interface FrontendTokenData {
  appId: string;
  channel: string;
  uid: string;
  rtcToken: string;
  rtmToken: string;
}

export default function VideoDiagnostics() {
  const { toast } = useToast();
  const [backendData, setBackendData] = useState<BackendCredentials | null>(null);
  const [frontendData, setFrontendData] = useState<FrontendTokenData | null>(null);
  const [loadingBackend, setLoadingBackend] = useState(true);
  const [loadingFrontend, setLoadingFrontend] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log("DIAGNOSTICS:", message);
    setLogs(prev => [...prev, logMessage]);
  };

  const { join, leave, isJoined } = useAgoraCore({
    appId: frontendData?.appId || '',
    onError: (error) => {
      addLog(`❌ Agora Error: ${error.message}`);
    }
  });

  // Fetch backend credentials on mount
  useEffect(() => {
    const fetchBackendCredentials = async () => {
      try {
        addLog("📡 Fetching backend credentials...");
        const { data, error } = await supabase.functions.invoke('agora-diagnostics', {
          body: { action: 'credentials' }
        });

        if (error) throw error;

        const credentials = data.data as BackendCredentials;
        setBackendData(credentials);
        addLog(`✅ Backend App ID: ${credentials.backendAppId}`);
        addLog(`✅ Backend Cert: ${credentials.backendCertFirst4}...${credentials.backendCertLast4}`);
      } catch (err: any) {
        addLog(`❌ Backend fetch failed: ${err.message}`);
        toast({
          title: "Failed to fetch backend credentials",
          description: err.message,
          variant: "destructive"
        });
      } finally {
        setLoadingBackend(false);
      }
    };

    fetchBackendCredentials();
  }, []);

  // Fetch frontend token data
  const fetchFrontendData = async () => {
    setLoadingFrontend(true);
    try {
      addLog("📡 Fetching frontend token data...");
      const testChannel = `diagnostics-${Date.now()}`;
      const testUid = `test-${Math.random().toString(36).substring(7)}`;

      const { data, error } = await supabase.functions.invoke('agora-token', {
        body: {
          channelName: testChannel,
          uid: testUid,
          role: 'publisher'
        }
      });

      if (error) throw error;

      const tokenData: FrontendTokenData = {
        appId: data.appId,
        channel: testChannel,
        uid: testUid,
        rtcToken: data.rtcToken,
        rtmToken: data.rtmToken
      };

      setFrontendData(tokenData);
      addLog(`✅ Frontend App ID: ${tokenData.appId}`);
      addLog(`✅ Channel: ${tokenData.channel}`);
      addLog(`✅ UID: ${tokenData.uid}`);
      addLog(`✅ RTC Token: ${tokenData.rtcToken.substring(0, 6)}...${tokenData.rtcToken.substring(tokenData.rtcToken.length - 6)}`);
    } catch (err: any) {
      addLog(`❌ Frontend token fetch failed: ${err.message}`);
      toast({
        title: "Failed to fetch tokens",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoadingFrontend(false);
    }
  };

  // Run connection self-test
  const runSelfTest = async () => {
    if (!frontendData) {
      toast({
        title: "No token data",
        description: "Fetch frontend data first",
        variant: "destructive"
      });
      return;
    }

    setTestStatus('testing');
    setTestError(null);
    addLog("🧪 Starting Agora connection self-test...");

    try {
      addLog(`🔥 AGORA FRONTEND FINAL APP ID USED: ${frontendData.appId}`);
      addLog(`Attempting to join channel: ${frontendData.channel}`);
      
      await join(frontendData.channel, frontendData.rtcToken, frontendData.uid);
      
      addLog("✅ FULL SUCCESS - Agora connection established!");
      setTestStatus('success');
      
      // Leave immediately after successful join
      setTimeout(async () => {
        await leave();
        addLog("✅ Left test channel");
      }, 1000);
    } catch (err: any) {
      const errorMessage = err.message || String(err);
      const errorCode = err.code || 'unknown';
      
      addLog(`❌ ERROR → ${errorMessage}`);
      addLog(`Error Code: ${errorCode}`);
      setTestError(`${errorCode}: ${errorMessage}`);
      setTestStatus('error');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`
    });
  };

  const maskToken = (token: string) => {
    if (!token || token.length < 12) return token;
    return `${token.substring(0, 6)}...${token.substring(token.length - 6)}`;
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Agora Video Diagnostics</h1>
        <p className="text-muted-foreground">
          Real-time validation of Agora credentials and connection status
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Backend Values */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {loadingBackend ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : backendData ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              Backend Values
            </CardTitle>
            <CardDescription>Credentials from Lovable Cloud</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingBackend ? (
              <div className="text-muted-foreground">Loading...</div>
            ) : backendData ? (
              <>
                <div>
                  <div className="text-sm font-medium mb-1">Backend App ID</div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted p-2 rounded font-mono">
                      {backendData.backendAppId}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(backendData.backendAppId, "Backend App ID")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Backend Certificate (masked)</div>
                  <code className="text-xs bg-muted p-2 rounded block font-mono">
                    {backendData.backendCertFirst4}...{backendData.backendCertLast4}
                  </code>
                  <div className="text-xs text-muted-foreground mt-1">
                    Length: {backendData.backendCertLength} chars
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Server Time</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(backendData.serverTime).toLocaleString()}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-red-500">Failed to load backend credentials</div>
            )}
          </CardContent>
        </Card>

        {/* Frontend Values */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {loadingFrontend ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : frontendData ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              )}
              Frontend Values
            </CardTitle>
            <CardDescription>Values used for video joins</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!frontendData ? (
              <Button onClick={fetchFrontendData} disabled={loadingFrontend}>
                {loadingFrontend ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  "Fetch Frontend Data"
                )}
              </Button>
            ) : (
              <>
                <div>
                  <div className="text-sm font-medium mb-1">Frontend App ID</div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted p-2 rounded font-mono">
                      {frontendData.appId}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(frontendData.appId, "Frontend App ID")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  {backendData && frontendData.appId === backendData.backendAppId ? (
                    <Badge variant="default" className="mt-2">✓ Matches Backend</Badge>
                  ) : (
                    <Badge variant="destructive" className="mt-2">✗ MISMATCH!</Badge>
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Channel</div>
                  <code className="text-xs bg-muted p-2 rounded block font-mono">
                    {frontendData.channel}
                  </code>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">UID</div>
                  <code className="text-xs bg-muted p-2 rounded block font-mono">
                    {frontendData.uid}
                  </code>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Token Values */}
        <Card>
          <CardHeader>
            <CardTitle>Token Values</CardTitle>
            <CardDescription>Masked tokens for security</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!frontendData ? (
              <div className="text-muted-foreground">Fetch frontend data to see tokens</div>
            ) : (
              <>
                <div>
                  <div className="text-sm font-medium mb-1">RTC Token (masked)</div>
                  <code className="text-xs bg-muted p-2 rounded block font-mono break-all">
                    {maskToken(frontendData.rtcToken)}
                  </code>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">RTM Token (masked)</div>
                  <code className="text-xs bg-muted p-2 rounded block font-mono break-all">
                    {maskToken(frontendData.rtmToken)}
                  </code>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Agora Self-Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {testStatus === 'testing' && <Loader2 className="h-5 w-5 animate-spin" />}
              {testStatus === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
              {testStatus === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
              Agora Self-Test
            </CardTitle>
            <CardDescription>Test actual Agora connection</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={runSelfTest}
              disabled={!frontendData || testStatus === 'testing' || isJoined}
              className="w-full"
            >
              {testStatus === 'testing' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Connection Test
                </>
              )}
            </Button>

            {testStatus !== 'idle' && (
              <>
                <Separator />
                <div>
                  <div className="text-sm font-medium mb-2">Status</div>
                  {testStatus === 'success' && (
                    <Badge variant="default" className="text-sm">
                      ✓ FULL SUCCESS
                    </Badge>
                  )}
                  {testStatus === 'error' && (
                    <Badge variant="destructive" className="text-sm">
                      ✗ FAILED
                    </Badge>
                  )}
                  {testStatus === 'testing' && (
                    <Badge variant="secondary" className="text-sm">
                      Testing...
                    </Badge>
                  )}
                </div>
                {testError && (
                  <div className="text-sm">
                    <div className="font-medium mb-1">Error Message</div>
                    <div className="text-xs bg-destructive/10 text-destructive p-2 rounded">
                      {testError}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Console Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Logs</CardTitle>
          <CardDescription>Real-time diagnostic output</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-black text-green-400 p-4 rounded font-mono text-xs max-h-96 overflow-y-auto space-y-1">
            {logs.length === 0 ? (
              <div className="text-gray-500">No logs yet...</div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx}>{log}</div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
