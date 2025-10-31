import { useState } from "react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRangeFilter } from "@/components/reporting/DateRangeFilter";
import { PerformanceDashboard } from "@/components/reporting/PerformanceDashboard";
import { EndOfDayReports } from "@/components/reporting/EndOfDayReports";
import { SubscriptionGuard } from "@/components/subscription/SubscriptionGuard";

export default function PracticeReporting() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(),
    to: new Date(),
  });

  return (
    <SubscriptionGuard
      feature="Practice Reporting"
      upgradeMessage="Get comprehensive performance analytics and daily reporting with VitaLuxePro"
    >
      <div className="patient-container">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold gold-text-gradient">Practice Reporting</h1>
          <p className="text-muted-foreground mt-2">
            Track performance metrics and generate end-of-day reports
          </p>
        </div>

        <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />

        <Tabs defaultValue="performance" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="space-y-4 sm:space-y-6">
            <PerformanceDashboard dateRange={dateRange} />
          </TabsContent>

          <TabsContent value="reports" className="space-y-4 sm:space-y-6">
            <EndOfDayReports dateRange={dateRange} />
          </TabsContent>
        </Tabs>
      </div>
    </SubscriptionGuard>
  );
}
