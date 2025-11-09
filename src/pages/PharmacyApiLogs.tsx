import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Download, RefreshCw, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PharmacyApiLogs = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pharmacyFilter, setPharmacyFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [page, setPage] = useState(0);
  const [detailsDialog, setDetailsDialog] = useState<any>(null);
  const [retrying, setRetrying] = useState(false);
  const pageSize = 50;

  // Fetch pharmacies for filter
  const { data: pharmacies } = useQuery({
    queryKey: ["pharmacies-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharmacies")
        .select("id, name")
        .eq("api_enabled", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch transmission logs
  const { data: logsData, refetch } = useQuery({
    queryKey: ["pharmacy-api-logs", pharmacyFilter, statusFilter, typeFilter, orderSearch, dateFrom, dateTo, page],
    queryFn: async () => {
      let query = supabase
        .from("pharmacy_order_transmissions")
        .select(`
          *,
          pharmacies (id, name)
        `, { count: 'exact' })
        .order("transmitted_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (pharmacyFilter !== "all") {
        query = query.eq("pharmacy_id", pharmacyFilter);
      }
      if (statusFilter === "success") {
        query = query.eq("success", true);
      } else if (statusFilter === "failed") {
        query = query.eq("success", false);
      }
      if (typeFilter !== "all") {
        query = query.eq("transmission_type", typeFilter);
      }
      if (orderSearch) {
        query = query.ilike("order_number", `%${orderSearch}%`);
      }
      if (dateFrom) {
        query = query.gte("transmitted_at", dateFrom.toISOString());
      }
      if (dateTo) {
        query = query.lte("transmitted_at", dateTo.toISOString());
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { logs: data, total: count || 0 };
    },
  });

  const handleSelectAll = () => {
    if (!logsData?.logs) return;
    const failedIds = logsData.logs.filter(log => !log.success).map(log => log.id);
    setSelectedIds(failedIds);
  };

  const handleRetry = async (transmissionIds: string[]) => {
    setRetrying(true);
    try {
      const { data, error } = await supabase.functions.invoke("retry-pharmacy-transmission", {
        body: { transmission_ids: transmissionIds },
      });

      if (error) throw error;

      toast.success(`Retry complete: ${data.successful} succeeded, ${data.failed} failed, ${data.skipped} skipped`);
      setSelectedIds([]);
      refetch();
    } catch (error: any) {
      toast.error("Failed to retry transmissions: " + error.message);
    } finally {
      setRetrying(false);
    }
  };

  const handleExport = () => {
    if (!logsData?.logs) return;

    const csv = [
      ["Timestamp", "Pharmacy", "Order ID", "Type", "Success", "Status Code", "Error", "Retry Count"].join(","),
      ...logsData.logs.map(log => [
        log.transmitted_at,
        `"${(log.pharmacies as any)?.name || 'Unknown'}"`,
        log.order_id,
        log.transmission_type,
        log.success,
        log.response_status || '',
        `"${log.error_message || ''}"`,
        log.retry_count || 0
      ].join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pharmacy_api_logs_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil((logsData?.total || 0) / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">Pharmacy API Logs</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          Monitor all API transmissions, errors, and tracking updates
        </p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Select value={pharmacyFilter} onValueChange={setPharmacyFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All Pharmacies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Pharmacies</SelectItem>
            {pharmacies?.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="new_order">New Order</SelectItem>
            <SelectItem value="cancellation">Cancellation</SelectItem>
            <SelectItem value="update">Update</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Search order number..."
          value={orderSearch}
          onChange={(e) => setOrderSearch(e.target.value)}
        />

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn(!dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFrom ? format(dateFrom, "PPP") : "From date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn(!dateTo && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateTo ? format(dateTo, "PPP") : "To date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
          </PopoverContent>
        </Popover>

        <Button onClick={handleExport} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-accent rounded-lg">
          <span className="text-sm font-medium">{selectedIds.length} transmissions selected</span>
          <div className="flex gap-2">
            <Button onClick={() => handleRetry(selectedIds)} disabled={retrying}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {retrying ? "Retrying..." : "Retry Selected"}
            </Button>
            <Button onClick={() => setSelectedIds([])} variant="outline">
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Button onClick={handleSelectAll} variant="ghost" size="sm">Select All Failed</Button>
              </TableHead>
              <TableHead>Timestamp</TableHead>
              <TableHead>Pharmacy</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>HTTP</TableHead>
              <TableHead>Retries</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logsData?.logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>
                  {!log.success && (
                    <Checkbox
                      checked={selectedIds.includes(log.id)}
                      onCheckedChange={(checked) => {
                        setSelectedIds(prev =>
                          checked ? [...prev, log.id] : prev.filter(id => id !== log.id)
                        );
                      }}
                    />
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {format(new Date(log.transmitted_at), "MMM d, yyyy HH:mm")}
                </TableCell>
                <TableCell>{(log.pharmacies as any)?.name || 'Unknown'}</TableCell>
                <TableCell className="font-mono text-sm">{log.order_id.slice(0, 8)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{log.transmission_type}</Badge>
                </TableCell>
                <TableCell>
                  {log.success ? (
                    <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Success</Badge>
                  ) : (
                    <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={
                    (log.response_status || 0) >= 200 && (log.response_status || 0) < 300 ? "default" :
                    (log.response_status || 0) >= 400 && (log.response_status || 0) < 500 ? "secondary" :
                    "destructive"
                  }>
                    {log.response_status || 'N/A'}
                  </Badge>
                </TableCell>
                <TableCell>{log.retry_count || 0}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button onClick={() => setDetailsDialog(log)} variant="ghost" size="sm">
                      Details
                    </Button>
                    {!log.success && (
                      <Button onClick={() => handleRetry([log.id])} variant="ghost" size="sm" disabled={retrying}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, logsData?.total || 0)} of {logsData?.total || 0}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} variant="outline">
            Previous
          </Button>
          <Button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1} variant="outline">
            Next
          </Button>
        </div>
      </div>

      {/* Details Dialog */}
      <Dialog open={!!detailsDialog} onOpenChange={() => setDetailsDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transmission Details</DialogTitle>
            <DialogDescription>Order {detailsDialog?.order_id.slice(0, 13)}</DialogDescription>
          </DialogHeader>
          {detailsDialog && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Request</h4>
                <pre className="bg-muted p-4 rounded text-xs overflow-auto max-h-48">
                  {JSON.stringify(detailsDialog.request_payload, null, 2)}
                </pre>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Response</h4>
                <pre className="bg-muted p-4 rounded text-xs overflow-auto max-h-48">
                  {detailsDialog.response_body || 'No response'}
                </pre>
              </div>
              {detailsDialog.error_message && (
                <div>
                  <h4 className="font-semibold mb-2 text-destructive">Error</h4>
                  <p className="text-sm bg-destructive/10 p-4 rounded">{detailsDialog.error_message}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PharmacyApiLogs;
