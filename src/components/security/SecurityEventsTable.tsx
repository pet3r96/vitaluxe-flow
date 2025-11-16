import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

export const SecurityEventsTable = () => {
  const { data: events, isLoading } = useQuery({
    queryKey: ["security-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      
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
    hasPrevPage,
  } = usePagination({
    totalItems: events?.length || 0,
    itemsPerPage: 25,
  });

  const paginatedEvents = events?.slice(startIndex, endIndex);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "destructive";
      case "high": return "destructive";
      case "medium": return "default";
      case "low": return "secondary";
      default: return "secondary";
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case "failed_login": return "Failed Login";
      case "brute_force": return "Brute Force Attack";
      case "anomaly": return "Anomaly Detected";
      case "bulk_download": return "Bulk Download";
      default: return type;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Security Events
        </CardTitle>
        <CardDescription>
          Failed logins, brute force attempts, and suspicious activity detection
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : events && events.length > 0 ? (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>User/Email</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEvents?.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">
                      {getEventTypeLabel(event.event_type)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getSeverityColor(event.severity)}>
                        {event.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>{event.user_email || "Anonymous"}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {event.ip_address || "N/A"}
                    </TableCell>
                    <TableCell>
                      {format(new Date(event.created_at), "PPp")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={goToPage}
              hasNextPage={hasNextPage}
              hasPrevPage={hasPrevPage}
              totalItems={events?.length || 0}
              startIndex={startIndex}
              endIndex={endIndex}
            />
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-2">No Security Events</p>
            <p className="text-sm">No security events have been detected yet.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
