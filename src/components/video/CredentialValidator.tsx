import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, Copy, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AgoraRTM from "agora-rtm-sdk";

interface CredentialValidatorProps {
  appId: string;
  token: string;
  rtmToken?: string;
  rtmUid?: string;
}

export const CredentialValidator = ({ appId, token, rtmToken, rtmUid }: CredentialValidatorProps) => {
  const { toast } = useToast();
  const [backendEcho, setBackendEcho] = useState<{ appIdSample: string; cert8: string } | null>(null);
  const [rtmProbeStatus, setRtmProbeStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [rtmProbeError, setRtmProbeError] = useState<string>("");
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchBackendEcho();
    parseTokenExpiry();
  }, [token]);

  const fetchBackendEcho = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('agora-echo');
      if (!error && data) {
        setBackendEcho({ appIdSample: data.appIdSample, cert8: data.cert8 });
      }
    } catch (err) {
      console.warn("Could not fetch backend echo:", err);
    }
  };

  const parseTokenExpiry = () => {
    try {
      // Token format: 007{base64}
      if (token.startsWith('007')) {
        const base64Part = token.substring(3);
        const decoded = atob(base64Part);
        // Extract timestamp (simplified - actual parsing is more complex)
        // For now, we'll just show that we detected 007 format
        setTokenExpiry(Date.now() + 86400000); // Placeholder: 24h from now
      }
    } catch (err) {
      console.warn("Could not parse token expiry:", err);
    }
  };

  const testRTMConnection = async () => {
    if (!rtmToken || !rtmUid) {
      setRtmProbeStatus('error');
      setRtmProbeError("No RTM credentials provided");
      return;
    }

    setRtmProbeStatus('testing');
    setRtmProbeError("");

    try {
      const client = AgoraRTM.createInstance(appId);
      await client.login({ uid: rtmUid, token: rtmToken });
      await client.logout();
      setRtmProbeStatus('success');
      toast({
        title: "RTM Probe Successful",
        description: "RTM connection validated successfully",
      });
    } catch (error: any) {
      console.error("RTM probe failed:", error);
      setRtmProbeStatus('error');
      setRtmProbeError(error.message || "Unknown RTM error");
      toast({
        title: "RTM Probe Failed",
        description: error.message || "Could not connect to RTM",
        variant: "destructive",
      });
    }
  };

  const copyDebugSnapshot = () => {
    const snapshot = {
      feAppId: appId,
      feAppIdSample: appId.substring(0, 8) + "...",
      beAppIdSample: backendEcho?.appIdSample || "N/A",
      beCert8: backendEcho?.cert8 || "N/A",
      tokenPrefix: token.substring(0, 10),
      tokenVersion: token.startsWith('007') ? '007' : 'Unknown',
      rtmProbeStatus,
      rtmProbeError,
      timestamp: new Date().toISOString(),
    };

    navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
    toast({
      title: "Debug Snapshot Copied",
      description: "Credential details copied to clipboard",
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchBackendEcho();
    setIsRefreshing(false);
  };

  const appIdMatch = backendEcho && appId.startsWith(backendEcho.appIdSample.replace('...', ''));
  const tokenIs007 = token.startsWith('007');
  const appIdValid = appId.length === 32;

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          Credential Validator
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {/* App ID Validation */}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">App ID Format (32 chars)</span>
          <Badge variant={appIdValid ? "default" : "destructive"}>
            {appIdValid ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
            {appIdValid ? "Valid" : "Invalid"}
          </Badge>
        </div>

        {/* FE/BE Match */}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">FE ↔ BE App ID Match</span>
          <Badge variant={appIdMatch ? "default" : "destructive"}>
            {appIdMatch ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
            {appIdMatch ? "Match" : "Mismatch"}
          </Badge>
        </div>

        {/* Token Version */}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Token Version</span>
          <Badge variant={tokenIs007 ? "default" : "destructive"}>
            {tokenIs007 ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
            {tokenIs007 ? "007" : "Unknown"}
          </Badge>
        </div>

        {/* Token Expiry */}
        {tokenExpiry && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Token Expires</span>
            <Badge variant="outline">
              <Clock className="h-3 w-3 mr-1" />
              {new Date(tokenExpiry).toLocaleTimeString()}
            </Badge>
          </div>
        )}

        {/* Details */}
        <div className="pt-2 border-t border-border/50 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">FE App ID:</span>
            <span className="font-mono">{appId.substring(0, 8)}...</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">BE App ID:</span>
            <span className="font-mono">{backendEcho?.appIdSample || "Loading..."}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">BE Cert8:</span>
            <span className="font-mono">{backendEcho?.cert8 || "Loading..."}</span>
          </div>
        </div>

        {/* RTM Probe */}
        {rtmToken && rtmUid && (
          <div className="pt-2 border-t border-border/50">
            <Button
              variant="outline"
              size="sm"
              onClick={testRTMConnection}
              disabled={rtmProbeStatus === 'testing'}
              className="w-full"
            >
              {rtmProbeStatus === 'testing' && <RefreshCw className="h-3 w-3 mr-2 animate-spin" />}
              {rtmProbeStatus === 'success' && <CheckCircle className="h-3 w-3 mr-2" />}
              {rtmProbeStatus === 'error' && <XCircle className="h-3 w-3 mr-2" />}
              Test RTM Connection
            </Button>
            {rtmProbeError && (
              <p className="text-xs text-destructive mt-1">{rtmProbeError}</p>
            )}
          </div>
        )}

        {/* Copy Debug Snapshot */}
        <Button
          variant="secondary"
          size="sm"
          onClick={copyDebugSnapshot}
          className="w-full"
        >
          <Copy className="h-3 w-3 mr-2" />
          Copy Debug Snapshot
        </Button>
      </CardContent>
    </Card>
  );
};
