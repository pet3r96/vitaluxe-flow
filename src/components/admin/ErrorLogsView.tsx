import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Eye, Loader2 } from "lucide-react";
import { ErrorDetailsDialog } from "./ErrorDetailsDialog";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

export const ErrorLogsView = () => {
  const [selectedError, setSelectedError] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errorTypeFilter, setErrorTypeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("24h");

  const { data: errorLogs, isLoading } = useQuery({
    queryKey: ["error-logs", errorTypeFilter, dateFilter],
    staleTime: 0,
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);

      // Filter by error types
      if (errorTypeFilter === "all") {
        query = query.in("action_type", [
          "client_error",
          "edge_function_error",
          "api_error",
        ]);
      } else {
        query = query.eq("action_type", errorTypeFilter);
      }

      // Filter by date range
      const now = new Date();
      let dateThreshold: Date;
      switch (dateFilter) {
        case "1h":
          dateThreshold = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case "24h":
          dateThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          dateThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      query = query.gte("created_at", dateThreshold.toISOString());

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
  });

  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    hasNextPage,
    hasPrevPage
  } = usePagination({
    totalItems: errorLogs?.length || 0,
    itemsPerPage: 25
  });

  const paginatedErrorLogs = errorLogs?.slice(startIndex, endIndex);

  const handleViewDetails = (error: any) => {
    setSelectedError(error);
    setDialogOpen(true);
  };

  const getErrorBadgeVariant = (actionType: string) => {
    if (actionType.includes("edge_function")) return "default";
    if (actionType.includes("api")) return "secondary";
    return "destructive";
  };

  const truncateMessage = (message: string, maxLength: number = 60) => {
    if (!message) return "No message";
    return message.length > maxLength
      ? message.substring(0, maxLength) + "..."
      : message;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Error Logs
          </CardTitle>
          <CardDescription>
            Real-time application errors and system issues
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={errorTypeFilter} onValueChange={setErrorTypeFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Error Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="client_error">Client Errors</SelectItem>
                <SelectItem value="edge_function_error">Edge Function</SelectItem>
                <SelectItem value="api_error">API Errors</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Error Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : errorLogs && errorLogs.length > 0 ? (
            <>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="hidden md:table-cell">Message</TableHead>
                      <TableHead className="hidden lg:table-cell">User</TableHead>
                      <TableHead className="hidden xl:table-cell">Component</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedErrorLogs?.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getErrorBadgeVariant(log.action_type)}>
                            {log.action_type.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell font-mono text-xs">
                          {truncateMessage(
                            (log.details as any)?.error_message ||
                              (log.details as any)?.message ||
                              "No message"
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs">
                          {log.user_email || "Anonymous"}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell font-mono text-xs">
                          {log.entity_type || "N/A"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(log)}
                            className="gap-2"
                          >
                            <Eye className="h-4 w-4" />
                            <span className="hidden sm:inline">View</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DataTablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
                hasNextPage={hasNextPage}
                hasPrevPage={hasPrevPage}
                totalItems={errorLogs.length}
                startIndex={startIndex}
                endIndex={Math.min(endIndex, errorLogs.length)}
              />
            </>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No errors found in the selected time range</p>
            </div>
          )}
        </CardContent>
      </Card>

      <ErrorDetailsDialog
        error={selectedError}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
};
