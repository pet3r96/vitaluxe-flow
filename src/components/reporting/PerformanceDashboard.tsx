import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Users, XCircle, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/contexts/AuthContext";

interface PerformanceDashboardProps {
  dateRange: { from: Date; to: Date };
}

export function PerformanceDashboard({ dateRange }: PerformanceDashboardProps) {
  const { effectivePracticeId } = useAuth();
  
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["performance-metrics", dateRange, effectivePracticeId],
    queryFn: async () => {
      if (!effectivePracticeId) {
        throw new Error("No practice ID available");
      }

      const from = new Date(dateRange.from);
      from.setHours(0, 0, 0, 0);
      const to = new Date(dateRange.to);
      to.setHours(23, 59, 59, 999);

      const { data: appointments, error } = await supabase
        .from("patient_appointments")
        .select(
          "id, status, start_time, end_time, service_type, cancellation_reason, provider_id, patient_id, practice_id"
        )
        .eq("practice_id", effectivePracticeId)
        .gte("start_time", from.toISOString())
        .lte("start_time", to.toISOString())
        .order("start_time", { ascending: true });

      if (error) throw error;

      const totalAppts = appointments?.length || 0;
      const cancelled = appointments?.filter(a => a.status === 'cancelled').length || 0;
      const completed = appointments?.filter(a => a.status === 'completed').length || 0;
      const cancelledPercentage = totalAppts > 0 ? ((cancelled / totalAppts) * 100).toFixed(1) : '0.0';

      const { count: newPatients } = await supabase
        .from("patient_accounts")
        .select("*", { count: 'exact', head: true })
        .eq("practice_id", effectivePracticeId)
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString());

      const providerStats = appointments?.reduce((acc: any, apt: any) => {
        const providerId = (apt as any).provider_id;
        if (!providerId) return acc;

        if (!acc[providerId]) {
          acc[providerId] = {
            name: `Provider ${String(providerId).slice(0, 6)}`,
            total: 0,
            cancelled: 0,
            completed: 0,
          };
        }

        acc[providerId].total++;
        if (apt.status === 'cancelled') acc[providerId].cancelled++;
        if (apt.status === 'completed') acc[providerId].completed++;

        return acc;
      }, {} as Record<string, any>);
      return {
        totalAppts,
        cancelled,
        cancelledPercentage,
        newPatients: newPatients || 0,
        completed,
        appointments: appointments || [],
        providerStats: Object.values(providerStats || {}),
      };
    },
    enabled: !!effectivePracticeId,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const appointmentsByDay: Record<string, number> = {};
  metrics?.appointments.forEach((apt: any) => {
    const day = format(new Date(apt.start_time), 'MMM dd');
    appointmentsByDay[day] = (appointmentsByDay[day] || 0) + 1;
  });

  const chartData = Object.entries(appointmentsByDay).map(([day, count]) => ({
    day,
    appointments: count,
  }));

  const cancellationReasons = metrics?.appointments
    .filter((a: any) => a.status === 'cancelled' && a.cancellation_reason)
    .reduce((acc: Record<string, number>, apt: any) => {
      acc[apt.cancellation_reason] = (acc[apt.cancellation_reason] || 0) + 1;
      return acc;
    }, {});

  const pieData = Object.entries(cancellationReasons || {}).map(([reason, count]) => ({
    name: reason,
    value: count,
  }));

  const COLORS = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ];

  const utilization = metrics?.totalAppts > 0 
    ? ((metrics.completed / metrics.totalAppts) * 100).toFixed(0) 
    : '0';

  return (
    <div className="space-y-6">
      {/* Summary Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Appointments</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalAppts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cancellations</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.cancelled}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.cancelledPercentage}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Provider Utilization</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{utilization}%</div>
            <p className="text-xs text-muted-foreground">
              Completed appointments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Patients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.newPatients}</div>
          </CardContent>
        </Card>
      </div>

      {/* Appointment Volume Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Appointment Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="appointments" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Cancellation Analysis */}
        {pieData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Cancellation Reasons</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => entry.name}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Provider Utilization Table */}
        <Card>
          <CardHeader>
            <CardTitle>Provider Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(metrics?.providerStats as any[])?.map((provider: any, idx: number) => {
                const util = provider.total > 0 
                  ? ((provider.completed / provider.total) * 100).toFixed(0) 
                  : '0';
                return (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{provider.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {provider.completed} of {provider.total} completed
                      </p>
                    </div>
                    <div className="text-lg font-bold">{util}%</div>
                  </div>
                );
              })}
              {(!metrics?.providerStats || (metrics.providerStats as any[]).length === 0) && (
                <p className="text-sm text-muted-foreground">No provider data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
