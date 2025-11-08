import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Loader2, 
  Video, 
  Clock, 
  DollarSign, 
  Download, 
  RefreshCw,
  Users,
  TrendingUp
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface UsageData {
  practice_id: string;
  practice_name: string;
  practice_email: string;
  billing_month: string;
  total_sessions: number;
  total_minutes: number;
  sessions_with_recordings: number;
  unique_providers_used: number;
  unique_patients_served: number;
}

interface BillingData {
  total_minutes: number;
  included_minutes: number;
  billable_minutes: number;
  minute_rate: number;
  minutes_cost: number;
  storage_gb: number;
  storage_cost: number;
  total_cost: number;
}

export function VideoUsageManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [billingData, setBillingData] = useState<Map<string, BillingData>>(new Map());
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState("current-month");

  useEffect(() => {
    loadUsageData();
  }, [dateRange]);

  const getDateRange = () => {
    const now = new Date();
    let start: Date, end: Date;

    switch (dateRange) {
      case "current-month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      case "last-month":
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        break;
      case "last-3-months":
        start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    return { start, end };
  };

  const loadUsageData = async () => {
    try {
      setLoading(true);
      const { start, end } = getDateRange();

      // Load aggregated usage data
      const { data: usage, error: usageError } = await supabase
        .from("video_usage_by_practice")
        .select("*")
        .gte("billing_month", start.toISOString())
        .lte("billing_month", end.toISOString())
        .order("total_minutes", { ascending: false });

      if (usageError) throw usageError;

      setUsageData(usage || []);

      // Load billing data for each practice
      if (usage && usage.length > 0) {
        const billingMap = new Map<string, BillingData>();
        
        for (const practice of usage) {
          const { data: billing, error: billingError } = await supabase
            .rpc("calculate_practice_video_bill", {
              p_practice_id: practice.practice_id,
              p_start_date: start.toISOString(),
              p_end_date: end.toISOString(),
            });

          if (!billingError && billing && billing.length > 0) {
            billingMap.set(practice.practice_id, billing[0]);
          }
        }

        setBillingData(billingMap);
      }
    } catch (error: any) {
      toast({
        title: "Error loading usage data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshMaterializedView = async () => {
    setRefreshing(true);
    try {
      const { error } = await supabase.rpc("refresh_video_usage_by_practice");
      if (error) throw error;

      toast({
        title: "Data refreshed",
        description: "Usage statistics have been updated.",
      });

      await loadUsageData();
    } catch (error: any) {
      toast({
        title: "Error refreshing data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const exportToCSV = () => {
    const headers = [
      "Practice Name",
      "Email",
      "Total Sessions",
      "Total Minutes",
      "Billable Minutes",
      "Minutes Cost",
      "Storage GB",
      "Storage Cost",
      "Total Cost"
    ];

    const rows = filteredData.map(practice => {
      const billing = billingData.get(practice.practice_id);
      return [
        practice.practice_name,
        practice.practice_email,
        practice.total_sessions,
        practice.total_minutes,
        billing?.billable_minutes || 0,
        `$${(billing?.minutes_cost || 0).toFixed(2)}`,
        billing?.storage_gb || 0,
        `$${(billing?.storage_cost || 0).toFixed(2)}`,
        `$${(billing?.total_cost || 0).toFixed(2)}`,
      ];
    });

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `video-usage-${dateRange}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredData = usageData.filter(
    (practice) =>
      practice.practice_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      practice.practice_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalMinutes = filteredData.reduce((sum, p) => sum + (p.total_minutes || 0), 0);
  const totalRevenue = Array.from(billingData.values()).reduce(
    (sum, b) => sum + (b.total_cost || 0),
    0
  );
  const avgMinutesPerPractice = filteredData.length > 0 ? totalMinutes / filteredData.length : 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Minutes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{totalMinutes.toFixed(1)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">${totalRevenue.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Minutes/Practice</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{avgMinutesPerPractice.toFixed(1)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Practices Using Video</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{filteredData.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Usage Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Video Usage by Practice
              </CardTitle>
              <CardDescription>Track video session usage and billing</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshMaterializedView}
                disabled={refreshing}
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <Input
              placeholder="Search practices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current-month">Current Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="last-3-months">Last 3 Months</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Data Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Practice</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead className="text-right">Total Minutes</TableHead>
                  <TableHead className="text-right">Billable Minutes</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No video usage data found for this period
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((practice) => {
                    const billing = billingData.get(practice.practice_id);
                    return (
                      <TableRow key={practice.practice_id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{practice.practice_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {practice.practice_email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{practice.total_sessions}</TableCell>
                        <TableCell className="text-right">
                          {practice.total_minutes.toFixed(1)} min
                        </TableCell>
                        <TableCell className="text-right">
                          {billing?.billable_minutes.toFixed(1) || 0} min
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${billing?.total_cost.toFixed(2) || "0.00"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
