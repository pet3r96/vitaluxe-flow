import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, MessageSquare, Bell, TrendingUp, CheckCircle2, XCircle } from "lucide-react";
import { useMemo } from "react";

interface NotificationAnalyticsProps {
  logs: any[];
}

export function NotificationAnalytics({ logs }: NotificationAnalyticsProps) {
  const stats = useMemo(() => {
    if (!logs || logs.length === 0) {
      return {
        totalSent: 0,
        byChannel: { email: 0, sms: 0, in_app: 0 },
        successRate: 0,
        failedCount: 0,
        deliveredCount: 0,
        byEventType: {},
      };
    }

    const totalSent = logs.length;
    const byChannel = logs.reduce((acc, log) => {
      acc[log.channel] = (acc[log.channel] || 0) + 1;
      return acc;
    }, { email: 0, sms: 0, in_app: 0 });

    const deliveredCount = logs.filter((l) => l.status === "delivered").length;
    const failedCount = logs.filter((l) => l.status === "failed").length;
    const successRate = totalSent > 0 ? ((totalSent - failedCount) / totalSent) * 100 : 0;

    const byEventType = logs.reduce((acc, log) => {
      if (!log.event_type) return acc;
      acc[log.event_type] = (acc[log.event_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalSent,
      byChannel,
      successRate,
      failedCount,
      deliveredCount,
      byEventType,
    };
  }, [logs]);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalSent}</div>
          <p className="text-xs text-muted-foreground">All notifications</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground">
            {stats.deliveredCount} delivered, {stats.failedCount} failed
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">By Channel</CardTitle>
          <Mail className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5">
                <Mail className="h-3 w-3" /> Email
              </span>
              <span className="font-bold">{stats.byChannel.email}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="h-3 w-3" /> SMS
              </span>
              <span className="font-bold">{stats.byChannel.sms}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5">
                <Bell className="h-3 w-3" /> In-App
              </span>
              <span className="font-bold">{stats.byChannel.in_app}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Top Events</CardTitle>
          <Bell className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {Object.entries(stats.byEventType)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .slice(0, 3)
              .map(([eventType, count]) => (
                <div key={eventType} className="flex items-center justify-between text-xs">
                  <span className="truncate max-w-[140px]" title={eventType}>
                    {eventType.replace(/_/g, " ")}
                  </span>
                  <span className="font-bold">{count as number}</span>
                </div>
              ))}
            {Object.keys(stats.byEventType).length === 0 && (
              <p className="text-xs text-muted-foreground">No events yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
