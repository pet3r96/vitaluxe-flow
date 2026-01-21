import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { RefreshCw, Clock, ChevronDown, ChevronRight, RotateCcw, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const VIOS_PHARMACY_ID = "d5e75179-e66c-450f-8cae-1f4df93b097c";

interface WebhookEvent {
  id: string;
  created_at: string;
  status_code: number | null;
  error_message: string | null;
  raw_payload: Record<string, unknown> | null;
  transformed_payload: Record<string, unknown> | null;
  order_line_id: string | null;
  is_duplicate: boolean | null;
  processing_time_ms: number | null;
  // These fields may not exist in older schema versions
  replayed_from_event_id?: string | null;
  replayed_at?: string | null;
  replayed_by?: string | null;
  replay_result?: string | null;
}

interface AuditLogFilters {
  statusCode: string;
  hideDuplicates: boolean;
  searchOrderLine: string;
}

export function ViosWebhookAuditLog() {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<AuditLogFilters>({
    statusCode: "all",
    hideDuplicates: false,
    searchOrderLine: "",
  });

  // Fetch webhook events from audit log
  const { data: webhookEvents, refetch, isLoading } = useQuery({
    queryKey: ["vios-webhook-events", filters],
    queryFn: async () => {
      let query = supabase
        .from("pharmacy_webhook_events")
        .select("*")
        .eq("pharmacy_id", VIOS_PHARMACY_ID)
        .order("created_at", { ascending: false })
        .limit(50);

      if (filters.statusCode !== "all") {
        query = query.eq("status_code", parseInt(filters.statusCode));
      }

      if (filters.hideDuplicates) {
        query = query.eq("is_duplicate", false);
      }

      if (filters.searchOrderLine) {
        query = query.ilike("order_line_id", `%${filters.searchOrderLine}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as WebhookEvent[];
    },
    refetchInterval: 30000,
  });

  const toggleRowExpansion = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const replayWebhook = async (eventId: string) => {
    setReplayingId(eventId);
    try {
      const { data, error } = await supabase.functions.invoke("replay-pharmacy-webhook", {
        body: { eventId },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Webhook replayed successfully");
      } else {
        toast.error(`Replay failed: ${data?.error || "Unknown error"}`);
      }
      refetch();
    } catch (error: any) {
      toast.error(`Replay failed: ${error.message}`);
      console.error("Replay error:", error);
    } finally {
      setReplayingId(null);
    }
  };

  const getStatusBadge = (statusCode: number | null, isDuplicate: boolean | null) => {
    if (isDuplicate) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
          Duplicate
        </Badge>
      );
    }
    if (statusCode === 200) {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          {statusCode}
        </Badge>
      );
    }
    if (statusCode && statusCode >= 400) {
      return <Badge variant="destructive">{statusCode}</Badge>;
    }
    return <Badge variant="secondary">{statusCode || "N/A"}</Badge>;
  };

  const canReplay = (event: WebhookEvent) => {
    // Can replay if it was an error (non-200) or if it's marked as needing replay
    return event.status_code !== 200 || event.is_duplicate;
  };

  const truncateId = (id: string | null) => {
    if (!id) return "-";
    return id.length > 12 ? `${id.slice(0, 8)}...` : id;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end p-4 bg-muted/30 rounded-lg border">
        <div className="space-y-1.5">
          <Label className="text-xs">Status Code</Label>
          <Select
            value={filters.statusCode}
            onValueChange={(value) => setFilters({ ...filters, statusCode: value })}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="200">200 OK</SelectItem>
              <SelectItem value="400">400 Error</SelectItem>
              <SelectItem value="401">401 Auth</SelectItem>
              <SelectItem value="500">500 Server</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Order Line ID</Label>
          <Input
            placeholder="Search..."
            value={filters.searchOrderLine}
            onChange={(e) => setFilters({ ...filters, searchOrderLine: e.target.value })}
            className="w-40"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="hideDuplicates"
            checked={filters.hideDuplicates}
            onChange={(e) => setFilters({ ...filters, hideDuplicates: e.target.checked })}
            className="rounded border-border"
          />
          <Label htmlFor="hideDuplicates" className="text-xs cursor-pointer">
            Hide duplicates
          </Label>
        </div>

        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Table */}
      {webhookEvents && webhookEvents.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Order Line</TableHead>
                <TableHead>Error</TableHead>
                <TableHead>Latency</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhookEvents.map((event) => (
                <>
                  <TableRow key={event.id} className="cursor-pointer" onClick={() => toggleRowExpansion(event.id)}>
                    <TableCell className="px-2">
                      {expandedRows.has(event.id) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(event.status_code, event.is_duplicate)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {truncateId(event.order_line_id)}
                    </TableCell>
                    <TableCell>
                      {event.error_message ? (
                        <span className="text-xs text-destructive max-w-[200px] truncate block">
                          {event.error_message}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {event.processing_time_ms ? (
                        <span className="text-xs text-muted-foreground">{event.processing_time_ms}ms</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {canReplay(event) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              disabled={replayingId === event.id}
                            >
                              {replayingId === event.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3 w-3" />
                              )}
                              Replay
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Replay Webhook Event?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will re-process the webhook payload and attempt to update the order line status.
                                The original event will be marked as replayed.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => replayWebhook(event.id)}>
                                Replay Event
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      {event.replayed_at && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Replayed
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Expanded Row Content */}
                  {expandedRows.has(event.id) && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-muted/30 p-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold">Raw Payload</Label>
                            <pre className="text-xs p-3 bg-background rounded-lg overflow-x-auto max-h-64 border">
                              {event.raw_payload
                                ? JSON.stringify(event.raw_payload, null, 2)
                                : "No raw payload"}
                            </pre>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold">Transformed Payload</Label>
                            <pre className="text-xs p-3 bg-background rounded-lg overflow-x-auto max-h-64 border">
                              {event.transformed_payload
                                ? JSON.stringify(event.transformed_payload, null, 2)
                                : "No transformed payload"}
                            </pre>
                          </div>
                        </div>

                        {/* Replay History */}
                        {event.replayed_from_event_id && (
                          <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-800 dark:text-blue-200">
                            <strong>This is a replay of event:</strong> {event.replayed_from_event_id}
                          </div>
                        )}
                        {event.replayed_at && (
                          <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded text-xs text-green-800 dark:text-green-200">
                            <strong>Replayed at:</strong> {new Date(event.replayed_at).toLocaleString()}
                            {event.replay_result && (
                              <span className="ml-2">• Result: {event.replay_result}</span>
                            )}
                          </div>
                        )}

                        {/* Full Error Details */}
                        {event.error_message && (
                          <div className="mt-3 space-y-1">
                            <Label className="text-xs font-semibold text-destructive">Error Details</Label>
                            <pre className="text-xs p-3 bg-destructive/10 text-destructive rounded-lg overflow-x-auto">
                              {event.error_message}
                            </pre>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/30">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading webhook events...
            </div>
          ) : (
            "No webhook events found. Events will appear here when VIOS sends webhooks."
          )}
        </div>
      )}

      {/* Summary Stats */}
      {webhookEvents && webhookEvents.length > 0 && (
        <div className="flex gap-4 text-xs text-muted-foreground pt-2">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            {webhookEvents.filter((e) => e.status_code === 200 && !e.is_duplicate).length} successful
          </span>
          <span className="flex items-center gap-1">
            <XCircle className="h-3 w-3 text-destructive" />
            {webhookEvents.filter((e) => e.status_code && e.status_code >= 400).length} errors
          </span>
          <span className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3 text-yellow-500" />
            {webhookEvents.filter((e) => e.is_duplicate).length} duplicates
          </span>
        </div>
      )}
    </div>
  );
}
