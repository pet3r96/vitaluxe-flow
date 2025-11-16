import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, DollarSign, Users } from "lucide-react";

export default function Reports() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports & Analytics</h1>
        <p className="text-muted-foreground">System-wide reporting and analytics</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Sales Reports
            </CardTitle>
            <CardDescription>Revenue and sales analytics</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              View detailed sales reports and trends
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Growth Metrics
            </CardTitle>
            <CardDescription>User and practice growth analytics</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Track platform growth and adoption rates
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Financial Reports
            </CardTitle>
            <CardDescription>Financial performance and forecasting</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Comprehensive financial analytics and reports
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Activity
            </CardTitle>
            <CardDescription>User engagement and activity metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Monitor user activity and engagement patterns
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
