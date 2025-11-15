import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

export function SubscriptionDiagnostics() {
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: practiceContext, isLoading: practiceLoading } = useQuery({
    queryKey: ['diagnostics-practice-context', refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('practice-context');
      if (error) throw error;
      return data;
    },
  });

  const { data: subscriptionStatus, isLoading: subscriptionLoading } = useQuery({
    queryKey: ['diagnostics-subscription-status', refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-practice-subscription-status');
      if (error) throw error;
      return data;
    },
  });

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const isLoading = practiceLoading || subscriptionLoading;

  // Compare results
  const practiceMatch = practiceContext?.practice?.id === subscriptionStatus?.practiceId;
  const statusMatch = practiceContext?.subscription?.status === subscriptionStatus?.status;
  const subscribedMatch = practiceContext?.subscription?.isSubscribed === subscriptionStatus?.isSubscribed;
  const allMatch = practiceMatch && statusMatch && subscribedMatch;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold gold-text-gradient">Subscription Diagnostics</h2>
          <p className="text-muted-foreground mt-1">
            Compare subscription status from different data sources
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isLoading}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Overall Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {allMatch ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                All Sources Match
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                Sources Diverge
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Practice ID Match:</span>
              {practiceMatch ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Match
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  Mismatch
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status Match:</span>
              {statusMatch ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Match
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  Mismatch
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">isSubscribed Match:</span>
              {subscribedMatch ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Match
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  Mismatch
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Practice Context (Unified) */}
      <Card>
        <CardHeader>
          <CardTitle>Practice Context (Unified)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : practiceContext?.success ? (
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium">Practice ID:</span>
                <p className="text-sm text-muted-foreground font-mono">{practiceContext.practice?.id || 'N/A'}</p>
              </div>
              <div>
                <span className="text-sm font-medium">Practice Name:</span>
                <p className="text-sm text-muted-foreground">{practiceContext.practice?.name || 'N/A'}</p>
              </div>
              <div>
                <span className="text-sm font-medium">Role Context:</span>
                <Badge variant="outline">{practiceContext.roleContext}</Badge>
              </div>
              <div>
                <span className="text-sm font-medium">Subscription Status:</span>
                <Badge variant={practiceContext.subscription?.isSubscribed ? "default" : "secondary"}>
                  {practiceContext.subscription?.status}
                </Badge>
              </div>
              <div>
                <span className="text-sm font-medium">Is Subscribed:</span>
                <Badge variant={practiceContext.subscription?.isSubscribed ? "default" : "destructive"}>
                  {practiceContext.subscription?.isSubscribed ? 'Yes' : 'No'}
                </Badge>
              </div>
              {practiceContext.subscription?.currentPeriodEnd && (
                <div>
                  <span className="text-sm font-medium">Period Ends:</span>
                  <p className="text-sm text-muted-foreground">
                    {new Date(practiceContext.subscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div>
              <Badge variant="destructive">Error</Badge>
              <p className="text-sm text-muted-foreground mt-2">{practiceContext?.reason || 'Failed to load'}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subscription Status (Legacy) */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription Status (Legacy)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : subscriptionStatus ? (
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium">Practice ID:</span>
                <p className="text-sm text-muted-foreground font-mono">{subscriptionStatus.practiceId || 'N/A'}</p>
              </div>
              <div>
                <span className="text-sm font-medium">Status:</span>
                <Badge variant={subscriptionStatus.isSubscribed ? "default" : "secondary"}>
                  {subscriptionStatus.status}
                </Badge>
              </div>
              <div>
                <span className="text-sm font-medium">Is Subscribed:</span>
                <Badge variant={subscriptionStatus.isSubscribed ? "default" : "destructive"}>
                  {subscriptionStatus.isSubscribed ? 'Yes' : 'No'}
                </Badge>
              </div>
              {subscriptionStatus.currentPeriodEnd && (
                <div>
                  <span className="text-sm font-medium">Period Ends:</span>
                  <p className="text-sm text-muted-foreground">
                    {new Date(subscriptionStatus.currentPeriodEnd).toLocaleDateString()}
                  </p>
                </div>
              )}
              {subscriptionStatus.trialDaysRemaining !== undefined && (
                <div>
                  <span className="text-sm font-medium">Trial Days Remaining:</span>
                  <p className="text-sm text-muted-foreground">{subscriptionStatus.trialDaysRemaining}</p>
                </div>
              )}
            </div>
          ) : (
            <Badge variant="destructive">Failed to load</Badge>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
