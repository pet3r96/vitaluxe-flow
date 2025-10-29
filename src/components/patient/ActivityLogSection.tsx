import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Monitor, LogOut } from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Session {
  id: string;
  last_activity: string;
  ip_address: string | null;
  user_agent: string | null;
}

function maskIP(ip: string | null): string {
  if (!ip || ip === 'unknown') return 'Unknown';
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.*.*`;
  }
  return ip;
}

function parseUserAgent(userAgent: string | null): string {
  if (!userAgent) return 'Unknown Device';
  
  // Simple parsing for common browsers and OS
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';
  
  if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
  else if (userAgent.includes('Edge')) browser = 'Edge';
  
  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';
  
  return `${browser} on ${os}`;
}

export function ActivityLogSection() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [displayLimit, setDisplayLimit] = useState(5);
  const [showAll, setShowAll] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async (limit?: number) => {
    try {
      setLoadingMore(true);
      
      // Get total count
      const { count } = await supabase
        .from('active_sessions')
        .select('*', { count: 'exact', head: true });
      
      setTotalCount(count || 0);

      // Fetch sessions with limit
      const { data, error } = await supabase
        .from('active_sessions')
        .select('id, last_activity, ip_address, user_agent')
        .order('last_activity', { ascending: false })
        .limit(limit || displayLimit);

      if (error) throw error;
      setSessions(data || []);
    } catch (error: any) {
      console.error('Error fetching sessions:', error);
      toast({
        title: "Error loading activity log",
        description: error.message || "Failed to fetch session history.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    const newLimit = displayLimit + 5;
    setDisplayLimit(newLimit);
    fetchSessions(newLimit);
  };

  const handleLoadAll = () => {
    setShowAll(true);
    fetchSessions(totalCount);
  };

  const handleSignOutAllDevices = async () => {
    setSigningOut(true);
    
    try {
      // Get current session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (!currentSession) {
        throw new Error('No active session found');
      }

      // Delete all sessions except the current one
      const { error } = await supabase
        .from('active_sessions')
        .delete()
        .neq('id', currentSession.access_token); // Keep current session

      if (error) throw error;

      toast({
        title: "Signed out from all devices",
        description: "You have been signed out from all other devices successfully.",
      });

      // Refresh the sessions list
      fetchSessions();
    } catch (error: any) {
      console.error('Error signing out:', error);
      toast({
        title: "Error signing out",
        description: error.message || "Failed to sign out from other devices.",
        variant: "destructive",
      });
    } finally {
      setSigningOut(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Account Activity
          </CardTitle>
          <CardDescription>Recent login history</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Account Activity
            </CardTitle>
            <CardDescription>Recent login history and active sessions</CardDescription>
          </div>
          {sessions.length > 1 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={signingOut}>
                  {signingOut ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing Out...
                    </>
                  ) : (
                    <>
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out All Devices
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sign out from all devices?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will sign you out from all other devices except this one. You'll need to sign in again on those devices.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSignOutAllDevices}>
                    Sign Out All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No recent activity found.</p>
        ) : (
          <>
            <div className="space-y-4">
              {sessions.map((session, index) => (
                <div
                  key={session.id}
                  className="flex items-start justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">
                        {parseUserAgent(session.user_agent)}
                      </p>
                      {index === 0 && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      IP: {maskIP(session.ip_address)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(session.last_activity), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Session count and load more buttons */}
            <div className="mt-4 pt-4 border-t space-y-3">
              <p className="text-xs text-muted-foreground text-center">
                Showing {sessions.length} of {totalCount} sessions
              </p>
              
              {sessions.length < totalCount && (
                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load More (5)'
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadAll}
                    disabled={loadingMore}
                  >
                    Load All ({totalCount - sessions.length} more)
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
