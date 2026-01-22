import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { RefreshCw, Clock, ChevronDown, ChevronRight, RotateCcw, Loader2, CheckCircle2, XCircle, AlertCircle, Trash2, ArrowDown, ArrowUp } from "lucide-react";
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
  replayed_from_event_id?: string | null;
  replayed_at?: string | null;
  replayed_by?: string | null;
  replay_result?: string | null;
}

interface ApiTransmission {
  id: string;
  created_at: string;
  order_id: string | null;
  order_line_id: string | null;
  pharmacy_id: string;
  transmission_type: string | null;
  api_endpoint: string | null;
  request_payload: Record<string, unknown> | null;
  response_body: Record<string, unknown> | null;
  response_status: number | null;
  success: boolean | null;
  error_message: string | null;
  pharmacy_order_id: string | null;
  retry_count: number | null;
  transmitted_at: string | null;
  manually_retried: boolean | null;
  retried_at: string | null;
  retried_by: string | null;
}

interface UnifiedAuditEvent {
  id: string;
  created_at: string;
  event_type: 'webhook' | 'api_call';
  direction: 'inbound' | 'outbound';
  status_code: number | null;
  success: boolean | null;
  error_message: string | null;
  order_line_id: string | null;
  latency_info: string | null;
  // Webhook-specific
  raw_payload?: Record<string, unknown> | null;
  transformed_payload?: Record<string, unknown> | null;
  is_duplicate?: boolean | null;
  replayed_from_event_id?: string | null;
  replayed_at?: string | null;
  replay_result?: string | null;
  // API call-specific
  request_payload?: Record<string, unknown> | null;
  response_body?: Record<string, unknown> | null;
  transmission_type?: string | null;
  pharmacy_order_id?: string | null;
  retry_count?: number | null;
}

interface AuditLogFilters {
  statusCode: string;
  hideDuplicates: boolean;
  searchOrderLine: string;
  eventType: 'all' | 'webhook' | 'api_call';
}

export function ViosWebhookAuditLog() {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [filters, setFilters] = useState<AuditLogFilters>({
    statusCode: "all",
    hideDuplicates: false,
    searchOrderLine: "",
    eventType: "all",
  });

  // Fetch webhook events
  const { data: webhookEvents, refetch: refetchWebhooks, isLoading: isLoadingWebhooks } = useQuery({
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

  // Fetch API transmissions
  const { data: apiTransmissions, refetch: refetchApi, isLoading: isLoadingApi } = useQuery({
    queryKey: ["vios-api-transmissions", filters],
    queryFn: async () => {
      let query = supabase
        .from("pharmacy_order_transmissions")
        .select("*")
        .eq("pharmacy_id", VIOS_PHARMACY_ID)
        .order("created_at", { ascending: false })
        .limit(50);

      if (filters.statusCode !== "all") {
        query = query.eq("response_status", parseInt(filters.statusCode));
      }

      if (filters.searchOrderLine) {
        query = query.ilike("order_line_id", `%${filters.searchOrderLine}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ApiTransmission[];
    },
    refetchInterval: 30000,
  });

  const isLoading = isLoadingWebhooks || isLoadingApi;

  // Combine and sort events
  const combinedEvents = useMemo(() => {
    const webhooks: UnifiedAuditEvent[] = (webhookEvents || []).map(e => ({
      id: e.id,
      created_at: e.created_at,
      event_type: 'webhook' as const,
      direction: 'inbound' as const,
      status_code: e.status_code,
      success: e.status_code === 200 && !e.is_duplicate,
      error_message: e.error_message,
      order_line_id: e.order_line_id,
      latency_info: e.processing_time_ms ? `${e.processing_time_ms}ms` : null,
      raw_payload: e.raw_payload,
      transformed_payload: e.transformed_payload,
      is_duplicate: e.is_duplicate,
      replayed_from_event_id: e.replayed_from_event_id,
      replayed_at: e.replayed_at,
      replay_result: e.replay_result,
    }));

    const apiCalls: UnifiedAuditEvent[] = (apiTransmissions || []).map(e => ({
      id: e.id,
      created_at: e.created_at,
      event_type: 'api_call' as const,
      direction: 'outbound' as const,
      status_code: e.response_status,
      success: e.success,
      error_message: e.error_message,
      order_line_id: e.order_line_id,
      latency_info: e.transmitted_at ? formatDistanceToNow(new Date(e.transmitted_at), { addSuffix: true }) : null,
      request_payload: e.request_payload,
      response_body: e.response_body,
      transmission_type: e.transmission_type,
      pharmacy_order_id: e.pharmacy_order_id,
      retry_count: e.retry_count,
    }));

    let events = [...webhooks, ...apiCalls];

    // Filter by event type
    if (filters.eventType === 'webhook') {
      events = events.filter(e => e.event_type === 'webhook');
    } else if (filters.eventType === 'api_call') {
      events = events.filter(e => e.event_type === 'api_call');
    }

    return events.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [webhookEvents, apiTransmissions, filters.eventType]);

  const refetch = () => {
    refetchWebhooks();
    refetchApi();
  };

  const clearAuditLogs = async () => {
    setIsClearing(true);
    try {
      // Clear webhook events
      const { error: webhookError } = await supabase
        .from("pharmacy_webhook_events")
        .delete()
        .eq("pharmacy_id", VIOS_PHARMACY_ID);

      if (webhookError) throw webhookError;

      // Clear API transmissions
      const { error: apiError } = await supabase
        .from("pharmacy_order_transmissions")
        .delete()
        .eq("pharmacy_id", VIOS_PHARMACY_ID);

      if (apiError) throw apiError;

      toast.success("All audit logs cleared successfully");
      refetch();
    } catch (error: any) {
      toast.error(`Failed to clear audit logs: ${error.message}`);
      console.error("Clear audit logs error:", error);
    } finally {
      setIsClearing(false);
    }
  };

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

  const getEventTypeBadge = (event: UnifiedAuditEvent) => {
    if (event.event_type === 'webhook') {
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 gap-1">
          <ArrowDown className="h-3 w-3" />
          Webhook
        </Badge>
      );
    }
    return (
      <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 gap-1">
        <ArrowUp className="h-3 w-3" />
        API Call
      </Badge>
    );
  };

  const getStatusBadge = (event: UnifiedAuditEvent) => {
    if (event.event_type === 'webhook' && event.is_duplicate) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
          Duplicate
        </Badge>
      );
    }
    if (event.success === true || event.status_code === 200) {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          {event.status_code || "OK"}
        </Badge>
      );
    }
    if (event.status_code && event.status_code >= 400) {
      return <Badge variant="destructive">{event.status_code}</Badge>;
    }
    if (event.success === false) {
      return <Badge variant="destructive">Failed</Badge>;
    }
    return <Badge variant="secondary">{event.status_code || "N/A"}</Badge>;
  };

  const canReplay = (event: UnifiedAuditEvent) => {
    // Can only replay webhook events, not API calls
    if (event.event_type !== 'webhook') return false;
    return event.status_code !== 200 || event.is_duplicate;
  };

  const truncateId = (id: string | null) => {
    if (!id) return "-";
    return id.length > 12 ? `${id.slice(0, 8)}...` : id;
  };

  const sanitizePayload = (payload: Record<string, unknown> | null | undefined) => {
    if (!payload) return null;
    // Hide PDF base64 data for readability
    const sanitized = { ...payload };
    if (sanitized.document && typeof sanitized.document === 'object') {
      const doc = sanitized.document as Record<string, unknown>;
      if (doc.pdfBase64) {
        sanitized.document = { ...doc, pdfBase64: '[PDF DATA HIDDEN]' };
      }
    }
    return sanitized;
  };

  const totalEvents = combinedEvents.length;
  const successfulWebhooks = combinedEvents.filter(e => e.event_type === 'webhook' && e.success).length;
  const successfulApiCalls = combinedEvents.filter(e => e.event_type === 'api_call' && e.success).length;
  const failedEvents = combinedEvents.filter(e => e.success === false || (e.status_code && e.status_code >= 400)).length;
  const duplicates = combinedEvents.filter(e => e.is_duplicate).length;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end p-4 bg-muted/30 rounded-lg border">
        <div className="space-y-1.5">
          <Label className="text-xs">Event Type</Label>
          <Select
            value={filters.eventType}
            onValueChange={(value: 'all' | 'webhook' | 'api_call') => setFilters({ ...filters, eventType: value })}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="webhook">Webhooks (Inbound)</SelectItem>
              <SelectItem value="api_call">API Calls (Outbound)</SelectItem>
            </SelectContent>
          </Select>
        </div>

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

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              disabled={totalEvents === 0 || isClearing}
            >
              {isClearing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Clear All
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all audit logs?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all VIOS webhook events AND API transmission logs.
                This action cannot be undone and you will lose all historical payload data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={clearAuditLogs}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete All Logs
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Table */}
      {combinedEvents.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Order Line</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Latency</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {combinedEvents.map((event) => (
                <>
                  <TableRow key={event.id} className="cursor-pointer" onClick={() => toggleRowExpansion(event.id)}>
                    <TableCell className="px-2">
                      {expandedRows.has(event.id) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>{getEventTypeBadge(event)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(event)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {truncateId(event.order_line_id)}
                    </TableCell>
                    <TableCell>
                      {event.error_message ? (
                        <span className="text-xs text-destructive max-w-[200px] truncate block">
                          {event.error_message}
                        </span>
                      ) : event.event_type === 'api_call' && event.transmission_type ? (
                        <span className="text-xs text-muted-foreground capitalize">
                          {event.transmission_type}
                        </span>
                      ) : event.event_type === 'api_call' && event.pharmacy_order_id ? (
                        <span className="text-xs text-muted-foreground">
                          VIOS #{event.pharmacy_order_id}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {event.latency_info ? (
                        <span className="text-xs text-muted-foreground">{event.latency_info}</span>
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
                      <TableCell colSpan={8} className="bg-muted/30 p-4">
                        {event.event_type === 'webhook' ? (
                          // Webhook details
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
                        ) : (
                          // API call details
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold">Request Payload</Label>
                              <pre className="text-xs p-3 bg-background rounded-lg overflow-x-auto max-h-64 border">
                                {event.request_payload
                                  ? JSON.stringify(sanitizePayload(event.request_payload), null, 2)
                                  : "No request payload"}
                              </pre>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold">Response Body</Label>
                              <pre className="text-xs p-3 bg-background rounded-lg overflow-x-auto max-h-64 border">
                                {event.response_body
                                  ? JSON.stringify(event.response_body, null, 2)
                                  : "No response body"}
                              </pre>
                            </div>
                          </div>
                        )}

                        {/* API call metadata */}
                        {event.event_type === 'api_call' && (
                          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                            {event.transmission_type && (
                              <span><strong>Type:</strong> {event.transmission_type}</span>
                            )}
                            {event.pharmacy_order_id && (
                              <span><strong>VIOS Order ID:</strong> {event.pharmacy_order_id}</span>
                            )}
                            {event.retry_count !== null && event.retry_count !== undefined && event.retry_count > 0 && (
                              <span><strong>Retries:</strong> {event.retry_count}</span>
                            )}
                          </div>
                        )}

                        {/* Replay History (webhooks only) */}
                        {event.event_type === 'webhook' && event.replayed_from_event_id && (
                          <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-800 dark:text-blue-200">
                            <strong>This is a replay of event:</strong> {event.replayed_from_event_id}
                          </div>
                        )}
                        {event.event_type === 'webhook' && event.replayed_at && (
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
              Loading audit events...
            </div>
          ) : (
            "No audit events found. Events will appear here when VIOS sends webhooks or API calls are made."
          )}
        </div>
      )}

      {/* Summary Stats */}
      {combinedEvents.length > 0 && (
        <div className="flex gap-4 text-xs text-muted-foreground pt-2">
          <span className="flex items-center gap-1">
            <ArrowDown className="h-3 w-3 text-blue-500" />
            {successfulWebhooks} webhooks received
          </span>
          <span className="flex items-center gap-1">
            <ArrowUp className="h-3 w-3 text-purple-500" />
            {successfulApiCalls} API calls sent
          </span>
          <span className="flex items-center gap-1">
            <XCircle className="h-3 w-3 text-destructive" />
            {failedEvents} errors
          </span>
          <span className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3 text-yellow-500" />
            {duplicates} duplicates
          </span>
        </div>
      )}
    </div>
  );
}
