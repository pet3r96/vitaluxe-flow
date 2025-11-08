import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Activity } from "lucide-react";
import { realtimeManager } from "@/lib/realtimeManager";

interface VideoSystemHealthProps {
  practiceId: string;
}

export const VideoSystemHealth = ({ practiceId }: VideoSystemHealthProps) => {
  const queryClient = useQueryClient();
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [edgeFunctionStatus, setEdgeFunctionStatus] = useState<"checking" | "healthy" | "error">("checking");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Check realtime connection status
    const checkRealtime = () => {
      const subscriptions = realtimeManager.getActiveSubscriptions();
      setRealtimeConnected(subscriptions.length > 0);
    };

    checkRealtime();
    const interval = setInterval(checkRealtime, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Check edge function deployment
    const checkEdgeFunctions = async () => {
      try {
        const { error } = await supabase.functions.invoke('start-video-session', {
          body: { sessionId: 'health-check-test' }
        });

        // We expect an error (invalid session), but if function responds, it's deployed
        if (error) {
          // Check if it's a "not found" error vs normal validation error
          const errorMessage = typeof error === 'object' && error !== null ? JSON.stringify(error) : String(error);
          if (errorMessage.includes('not found') || errorMessage.includes('404')) {
            setEdgeFunctionStatus("error");
          } else {
            setEdgeFunctionStatus("healthy"); // Function is responding, just validation error
          }
        } else {
          setEdgeFunctionStatus("healthy");
        }
      } catch (err) {
        setEdgeFunctionStatus("error");
      }
    };

    checkEdgeFunctions();
  }, []);

  const handleForceRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['provider-video-sessions', practiceId] });
      await queryClient.refetchQueries({ queryKey: ['provider-video-sessions', practiceId] });
      setLastRefresh(new Date());
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusIcon = (status: boolean | "checking" | "healthy" | "error") => {
    if (status === "checking") return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    if (status === "healthy" || status === true) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getStatusBadge = (status: boolean | "checking" | "healthy" | "error") => {
    if (status === "checking") return <Badge variant="outline" className="bg-yellow-50">Checking</Badge>;
    if (status === "healthy" || status === true) return <Badge variant="outline" className="bg-green-50 text-green-700">Healthy</Badge>;
    return <Badge variant="outline" className="bg-red-50 text-red-700">Error</Badge>;
  };

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Video System Health
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleForceRefresh}
            disabled={isRefreshing}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon(realtimeConnected)}
            <span className="text-sm text-muted-foreground">Realtime Connection</span>
          </div>
          {getStatusBadge(realtimeConnected)}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon(edgeFunctionStatus)}
            <span className="text-sm text-muted-foreground">Edge Functions</span>
          </div>
          {getStatusBadge(edgeFunctionStatus)}
        </div>

        <div className="pt-2 border-t border-border/40">
          <div className="text-xs text-muted-foreground">
            Last refresh: {lastRefresh.toLocaleTimeString()}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Active subscriptions: {realtimeManager.getActiveSubscriptions().join(', ') || 'None'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
