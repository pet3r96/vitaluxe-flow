// 🧹 TODO AGORA REFACTOR
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Copy, CheckCircle2, AlertCircle } from "lucide-react";

export default function TestAgoraToken() {
  const [loading, setLoading] = useState(false);
  const [tokenData, setTokenData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const generateTestToken = async () => {
    setLoading(true);
    setTokenData(null);
    
    try {
      console.warn("[TestAgoraToken] Agora token generation disabled pending refactor");
      /*
      const { data, error } = await supabase.functions.invoke('test-agora-token');
      
      if (error) throw error;
      
      setTokenData(data);
      toast({
        title: "Token Generated",
        description: "Sample Agora token generated successfully",
      });
      */
      setTokenData(null);
    } catch (error: any) {
      console.error("Error generating token:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate token",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({
      title: "Copied",
      description: "Token copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="container max-w-4xl py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Agora Token Test</h1>
          <p className="text-muted-foreground mt-2">
            Generate sample Agora RTC tokens for validation purposes
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Generate Test Token</CardTitle>
            <CardDescription>
              This will generate a sample Agora token with random test data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={generateTestToken} 
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate Sample Token
            </Button>
          </CardContent>
        </Card>

        {tokenData && (
          <>
            <Card className="border-green-500/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <CardTitle>Token Generated Successfully</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold mb-2">Test Parameters</h3>
                  <div className="bg-muted p-4 rounded-lg space-y-2 font-mono text-sm">
                    <div><span className="text-muted-foreground">Channel:</span> {tokenData.testData?.channelName}</div>
                    <div><span className="text-muted-foreground">UID:</span> {tokenData.testData?.uid}</div>
                    <div><span className="text-muted-foreground">Role:</span> {tokenData.testData?.role}</div>
                    <div><span className="text-muted-foreground">Expires In:</span> {tokenData.testData?.expiresInSeconds}s</div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-2">Token Info</h3>
                  <div className="bg-muted p-4 rounded-lg space-y-2 font-mono text-sm">
                    <div><span className="text-muted-foreground">App ID:</span> {tokenData.tokens?.appId}</div>
                    <div><span className="text-muted-foreground">Version:</span> {tokenData.tokenInfo?.version}</div>
                    <div><span className="text-muted-foreground">Length:</span> {tokenData.tokenInfo?.length} chars</div>
                    <div><span className="text-muted-foreground">Expires At:</span> {tokenData.tokens?.expiresAtISO}</div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold">RTC Token</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(tokenData.tokens?.rtcToken)}
                    >
                      {copied ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="bg-muted p-4 rounded-lg break-all font-mono text-xs">
                    {tokenData.tokens?.rtcToken}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold">RTM Token</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(tokenData.tokens?.rtmToken)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="bg-muted p-4 rounded-lg break-all font-mono text-xs">
                    {tokenData.tokens?.rtmToken}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Note: RTC and RTM tokens are the same in Agora's new Signaling system
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {tokenData === null && !loading && (
          <Card className="border-yellow-500/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                <CardTitle>No Token Generated Yet</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Click the button above to generate a sample token for testing
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
