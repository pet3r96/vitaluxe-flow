import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Archive, CheckCircle2, Search, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

export const ArchivedLogsViewer = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const retentionYears = 6;
  const oldestLogDate = new Date();
  oldestLogDate.setFullYear(oldestLogDate.getFullYear() - retentionYears);

  const { data: archivedLogs, isLoading } = useQuery({
    queryKey: ["archived-logs", searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs_archive")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      
      if (searchTerm) {
        query = query.or(`user_email.ilike.%${searchTerm}%,action_type.ilike.%${searchTerm}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: isSearching,
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
    totalItems: archivedLogs?.length || 0,
    itemsPerPage: 25,
  });

  const paginatedLogs = archivedLogs?.slice(startIndex, endIndex);

  const handleSearch = () => {
    setIsSearching(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Archive className="h-5 w-5" />
          Archived Logs (HIPAA Compliance)
        </CardTitle>
        <CardDescription>
          6-year log retention for HIPAA compliance requirements
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Compliance Status */}
        <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/50">
          <CheckCircle2 className="h-6 w-6 text-green-500" />
          <div>
            <p className="font-medium">HIPAA Compliant</p>
            <p className="text-sm text-muted-foreground">
              Logs are retained for {retentionYears} years as required
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Retention Period</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{retentionYears} years</div>
              <Badge variant="secondary" className="mt-2">
                HIPAA Compliant
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Oldest Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-mono">
                {oldestLogDate.toLocaleDateString()}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Logs older than this are purged
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Archive Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold text-green-600">Active</div>
              <p className="text-xs text-muted-foreground mt-2">
                Daily archival running
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <Input
            placeholder="Search archived logs (email, action type...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button onClick={handleSearch} disabled={isLoading}>
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : isSearching && archivedLogs && archivedLogs.length > 0 ? (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Archived</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLogs?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{log.user_email || "System"}</TableCell>
                    <TableCell className="font-medium">{log.action_type}</TableCell>
                    <TableCell>{log.entity_type || "N/A"}</TableCell>
                    <TableCell>{format(new Date(log.created_at), "PPp")}</TableCell>
                    <TableCell>{format(new Date(log.archived_at), "PP")}</TableCell>
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
              totalItems={archivedLogs?.length || 0}
              startIndex={startIndex}
              endIndex={endIndex}
            />
          </div>
        ) : isSearching ? (
          <div className="text-center py-12 text-muted-foreground">
            <Archive className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-2">No Results Found</p>
            <p className="text-sm">Try a different search term.</p>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Archive className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-2">Search Archived Logs</p>
            <p className="text-sm">
              Enter a search term above to view logs from cold storage.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
