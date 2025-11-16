import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Users, Eye, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export const PHIAccessMonitor = () => {
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("24h");

  const { data: accessLogs, isLoading } = useQuery({
    queryKey: ["phi-access-logs", entityFilter, dateFilter],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      // Filter by date
      const now = new Date();
      if (dateFilter === "24h") {
        query = query.gte("created_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());
      } else if (dateFilter === "7d") {
        query = query.gte("created_at", new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());
      } else if (dateFilter === "30d") {
        query = query.gte("created_at", new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString());
      }

      // Filter by PHI-related actions including medical vault share links
      const phiActions = [
        "SELECT_patient", "UPDATE_patient", "INSERT_patient", "DELETE_patient",
        "prescription_accessed", "cart_line_accessed",
        "medical_vault_share_link_accessed",
        "medical_vault_share_link_already_used",
        "medical_vault_share_link_expired",
        "medical_vault_share_link_revoked"
      ];

      if (entityFilter !== "all") {
        query = query.eq("action_type", entityFilter);
      } else {
        query = query.in("action_type", phiActions);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["phi-access-stats", dateFilter],
    queryFn: async () => {
      const now = new Date();
      let cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      if (dateFilter === "7d") {
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (dateFilter === "30d") {
        cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const phiActions = [
        "SELECT_patient", "UPDATE_patient", "INSERT_patient", "DELETE_patient",
        "prescription_accessed", "cart_line_accessed",
        "medical_vault_share_link_accessed",
        "medical_vault_share_link_already_used",
        "medical_vault_share_link_expired",
        "medical_vault_share_link_revoked"
      ];

      const { data, error } = await supabase
        .from("audit_logs")
        .select("user_id, user_email, entity_id")
        .in("action_type", phiActions)
        .gte("created_at", cutoff.toISOString());

      if (error) throw error;

      const uniqueUsers = new Set(data?.map(log => log.user_id) || []);
      const uniqueEntities = new Set(data?.map(log => log.entity_id) || []);

      return {
        totalAccesses: data?.length || 0,
        uniqueUsers: uniqueUsers.size,
        uniqueEntities: uniqueEntities.size,
      };
    },
  });

  const exportToCSV = () => {
    if (!accessLogs) return;

    const headers = ["Timestamp", "User", "Role", "Action", "Entity Type", "Entity ID"];
    const rows = accessLogs.map(log => [
      format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss"),
      log.user_email || "N/A",
      log.user_role || "N/A",
      log.action_type,
      log.entity_type || "N/A",
      log.entity_id || "N/A",
    ]);

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `phi-access-log-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total PHI Accesses</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalAccesses || 0}</div>
            <p className="text-xs text-muted-foreground">
              In the last {dateFilter === "24h" ? "24 hours" : dateFilter === "7d" ? "7 days" : "30 days"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.uniqueUsers || 0}</div>
            <p className="text-xs text-muted-foreground">Accessing PHI data</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Records Accessed</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.uniqueEntities || 0}</div>
            <p className="text-xs text-muted-foreground">Unique patient records</p>
          </CardContent>
        </Card>
      </div>

      {/* Access Log Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>PHI Access Audit Log</CardTitle>
              <CardDescription>
                HIPAA-compliant monitoring of all Protected Health Information access
              </CardDescription>
            </div>
            <Button onClick={exportToCSV} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
          <div className="flex gap-4 mt-4">
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All PHI Access</SelectItem>
                <SelectItem value="SELECT_patient">Patient Views</SelectItem>
                <SelectItem value="UPDATE_patient">Patient Updates</SelectItem>
                <SelectItem value="prescription_accessed">Prescriptions</SelectItem>
                <SelectItem value="cart_line_accessed">Cart Access</SelectItem>
                <SelectItem value="medical_vault_share_link_accessed">Share Link Access</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : accessLogs && accessLogs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accessLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {format(new Date(log.created_at), "MMM dd, HH:mm:ss")}
                    </TableCell>
                    <TableCell className="font-medium">{log.user_email || "N/A"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.user_role || "N/A"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.action_type.includes("UPDATE") || log.action_type.includes("DELETE") ? "destructive" : "secondary"}>
                        {log.action_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.entity_type || "N/A"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium mb-2">No PHI Access Logs</p>
              <p className="text-sm">No protected health information has been accessed in this time period.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
