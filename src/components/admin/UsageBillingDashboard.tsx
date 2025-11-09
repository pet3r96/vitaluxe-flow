import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Clock, Users, TrendingUp, Video } from "lucide-react";
import { format, subDays, startOfMonth } from "date-fns";

export const UsageBillingDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const { toast } = useToast();
  const [practiceId, setPracticeId] = useState<string | null>(null);

  useEffect(() => {
    const fetchPracticeAndUsage = async () => {
      try {
        // Get current user's practice
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Check if user is admin or practice owner
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        const isAdmin = userRoles?.some(r => r.role === 'admin');
        let effectivePracticeId = user.id; // Default to user ID as practice owner

        if (!isAdmin) {
          // Check if user is staff
          const { data: staffRecord } = await supabase
            .from('providers')
            .select('practice_id')
            .eq('user_id', user.id)
            .eq('active', true)
            .maybeSingle();

          if (staffRecord) {
            effectivePracticeId = staffRecord.practice_id;
          }
        }

        setPracticeId(effectivePracticeId);

        // Fetch usage stats for current month
        const startDate = startOfMonth(new Date()).toISOString();
        const endDate = new Date().toISOString();

        const { data, error } = await supabase.functions.invoke('get-practice-usage-stats', {
          body: {
            practiceId: effectivePracticeId,
            startDate,
            endDate
          }
        });

        if (error) throw error;
        setStats(data);
      } catch (error: any) {
        console.error('Error fetching usage stats:', error);
        toast({
          title: "Error",
          description: "Failed to load usage statistics",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPracticeAndUsage();
  }, [toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const totalHours = Math.floor((stats?.totalMinutes || 0) / 60);
  const remainingMinutes = (stats?.totalMinutes || 0) % 60;
  const avgSessionDuration = stats?.totalSessions > 0 
    ? Math.round((stats?.totalMinutes || 0) / stats.totalSessions)
    : 0;

  // Estimated cost calculation (example: $0.10 per minute)
  const estimatedCost = ((stats?.totalMinutes || 0) * 0.10).toFixed(2);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Usage & Billing</h2>
        <p className="text-muted-foreground mt-1">
          Track video session usage for this month
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Minutes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalMinutes || 0}</div>
            <p className="text-xs text-muted-foreground">
              {totalHours}h {remainingMinutes}m this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalSessions || 0}</div>
            <p className="text-xs text-muted-foreground">
              Video consultations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgSessionDuration} min</div>
            <p className="text-xs text-muted-foreground">
              Per session
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estimated Cost</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${estimatedCost}</div>
            <p className="text-xs text-muted-foreground">
              Based on $0.10/min
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Provider Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Usage by Provider</CardTitle>
          <CardDescription>
            Video session minutes per provider
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.providerStats && stats.providerStats.length > 0 ? (
            <div className="space-y-4">
              {stats.providerStats.map((provider: any) => (
                <div key={provider.provider_id} className="flex items-center justify-between border-b border-border pb-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">
                        {provider.provider_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {provider.session_count} sessions
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-foreground">{provider.total_minutes} min</p>
                    <p className="text-sm text-muted-foreground">
                      ${(provider.total_minutes * 0.10).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No usage data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
