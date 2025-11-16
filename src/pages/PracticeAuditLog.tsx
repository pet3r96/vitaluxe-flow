import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Shield, Power, PowerOff } from "lucide-react";
import { format } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

interface AuditLog {
  id: string;
  created_at: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  user_email: string;
  user_role: string;
  details: {
    practice_name?: string;
    previous_status?: boolean;
    new_status?: boolean;
    reason?: string;
  };
  ip_address: string;
}

const PracticeAuditLog = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ["practice-audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("entity_type", "practice")
        .in("action_type", ["practice_status_changed", "practice_disabled", "practice_enabled"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AuditLog[];
    },
  });

  const filteredLogs = auditLogs?.filter((log) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      log.user_email?.toLowerCase().includes(searchLower) ||
      log.details?.practice_name?.toLowerCase().includes(searchLower) ||
      log.action_type?.toLowerCase().includes(searchLower) ||
      log.ip_address?.toLowerCase().includes(searchLower)
    );
  });

  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    hasNextPage,
    hasPrevPage,
  } = usePagination({
    totalItems: filteredLogs?.length || 0,
    itemsPerPage: 50,
  });

  const paginatedLogs = filteredLogs?.slice(startIndex, endIndex);

  const getActionIcon = (actionType: string) => {
    if (actionType === "practice_disabled") return <PowerOff className="h-4 w-4 text-destructive" />;
    if (actionType === "practice_enabled") return <Power className="h-4 w-4 text-success" />;
    return <Shield className="h-4 w-4" />;
  };

  const getActionBadge = (actionType: string, details: AuditLog["details"]) => {
    if (actionType === "practice_disabled" || details?.new_status === false) {
      return <Badge variant="destructive">Disabled</Badge>;
    }
    if (actionType === "practice_enabled" || details?.new_status === true) {
      return <Badge variant="success">Enabled</Badge>;
    }
    return <Badge variant="outline">{actionType}</Badge>;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Practice Audit Log</h1>
          <p className="text-muted-foreground mt-1">
            Track all practice status changes and administrative actions
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status Change History</CardTitle>
          <CardDescription>
            View all practice account activations and deactivations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by admin email, practice name, or IP address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Practice Name</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Status Change</TableHead>
                  <TableHead>Admin User</TableHead>
                  <TableHead>Admin Role</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      Loading audit logs...
                    </TableCell>
                  </TableRow>
                ) : filteredLogs?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No audit logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLogs?.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm whitespace-nowrap">
                        {format(new Date(log.created_at), "MMM dd, yyyy HH:mm:ss")}
                      </TableCell>
                      <TableCell className="font-medium">
                        {log.details?.practice_name || "Unknown Practice"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getActionIcon(log.action_type)}
                          <span className="capitalize">
                            {log.action_type.replace(/_/g, " ")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getActionBadge(log.action_type, log.details)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.user_email || "System"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" size="sm">
                          {log.user_role || "system"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {log.ip_address || "N/A"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {filteredLogs && filteredLogs.length > 0 && (
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={goToPage}
              hasNextPage={hasNextPage}
              hasPrevPage={hasPrevPage}
              totalItems={filteredLogs.length}
              startIndex={startIndex}
              endIndex={Math.min(endIndex, filteredLogs.length)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PracticeAuditLog;
