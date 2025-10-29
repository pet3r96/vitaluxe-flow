import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRangeFilter } from "@/components/reporting/DateRangeFilter";
import { PerformanceDashboard } from "@/components/reporting/PerformanceDashboard";
import { EndOfDayReports } from "@/components/reporting/EndOfDayReports";
import { SubscriptionGuard } from "@/components/subscription/SubscriptionGuard";
import { AlertCircle } from "lucide-react";

export default function PracticeReporting() {
  const { effectiveRole, isProviderAccount } = useAuth();
  const { isSubscribed } = useSubscription();
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(),
    to: new Date(),
  });

  // Block providers from accessing this page
  if (isProviderAccount) {
    return (
      <div className="container mx-auto py-6 max-w-4xl">
        <Card className="p-8">
          <div className="flex items-center gap-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div>
              <h2 className="text-2xl font-bold text-foreground">Access Denied</h2>
              <p className="text-muted-foreground mt-2">
                Practice Reporting is only available to practice owners and staff members.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <SubscriptionGuard
      feature="Practice Reporting"
      upgradeMessage="Get comprehensive performance analytics and daily reporting with VitaLuxePro"
    >
      <div className="container mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Practice Reporting</h1>
          <p className="text-muted-foreground mt-2">
            Track performance metrics and generate end-of-day reports
          </p>
        </div>

        <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />

        <Tabs defaultValue="performance" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="performance">Performance Dashboard</TabsTrigger>
            <TabsTrigger value="reports">End-of-Day Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="space-y-4">
            <PerformanceDashboard dateRange={dateRange} />
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <EndOfDayReports dateRange={dateRange} />
          </TabsContent>
        </Tabs>
      </div>
    </SubscriptionGuard>
  );
}
