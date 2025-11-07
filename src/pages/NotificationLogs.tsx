import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mail, MessageSquare, Bell, ArrowDown, ArrowUp, Clock } from "lucide-react";
import { format } from "date-fns";

export default function NotificationLogs() {
  const { effectivePracticeId, effectiveRole } = useAuth();
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const { data: logs, isLoading } = useRealtimeQuery(
    ["notification_logs", effectivePracticeId],
    async () => {
      let query = (supabase as any)
        .from("notification_logs")
        .select("*, profiles(first_name, last_name, email)")
        .order("created_at", { ascending: false })
        .limit(200);

      // Filter by practice for non-admins
      if (effectiveRole !== "admin" && effectiveRole !== "super_admin" && effectivePracticeId) {
        query = query.eq("practice_id", effectivePracticeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    { staleTime: 30000 } // Cache for 30 seconds
  );

  const filteredLogs = (logs as any)?.filter((log: any) => {
    const matchesSearch = 
      search === "" ||
      log.recipient?.toLowerCase().includes(search.toLowerCase()) ||
      log.sender?.toLowerCase().includes(search.toLowerCase()) ||
      log.message_body?.toLowerCase().includes(search.toLowerCase());
    
    const matchesChannel = channelFilter === "all" || log.channel === channelFilter;
    const matchesStatus = statusFilter === "all" || log.status === statusFilter;

    return matchesSearch && matchesChannel && matchesStatus;
  });

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "email": return <Mail className="h-4 w-4" />;
      case "sms": return <MessageSquare className="h-4 w-4" />;
      case "in_app": return <Bell className="h-4 w-4" />;
      default: return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      delivered: "default",
      sent: "secondary",
      failed: "destructive",
      read: "outline",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Notification Logs</h1>
          <p className="text-sm text-muted-foreground">Track all notification delivery and status</p>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-1 sm:space-y-1.5">
          <CardTitle className="text-lg sm:text-xl">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <Input
              placeholder="Search recipient"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Channels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="in_app">In-App</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="read">Read</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4 sm:p-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredLogs && filteredLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Date/Time</TableHead>
                    <TableHead className="whitespace-nowrap">Channel</TableHead>
                    <TableHead className="whitespace-nowrap">Direction</TableHead>
                    <TableHead className="whitespace-nowrap">Recipient</TableHead>
                    <TableHead className="whitespace-nowrap">Event</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="whitespace-nowrap">Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {filteredLogs.map((log: any) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedLog(log)}
                  >
                    <TableCell className="whitespace-nowrap text-xs sm:text-sm">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                        <span className="hidden sm:inline">
                          {format(new Date(log.created_at), "MMM d, h:mm a")}
                        </span>
                        <span className="sm:hidden">
                          {format(new Date(log.created_at), "MMM d")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        {getChannelIcon(log.channel)}
                        <span className="capitalize hidden sm:inline">{log.channel}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        {log.direction === "outbound" ? (
                          <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                        ) : (
                          <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                        )}
                        <span className="capitalize hidden sm:inline">{log.direction}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">
                      {log.recipient || log.sender || "—"}
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm">
                      <span className="text-muted-foreground hidden sm:inline">{log.event_type}</span>
                      <span className="sm:hidden">•</span>
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm">{getStatusBadge(log.status)}</TableCell>
                    <TableCell className="text-xs sm:text-sm max-w-[150px] sm:max-w-xs truncate">
                      {log.message_body}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          ) : (
            <div className="text-center py-8 sm:py-12 text-sm text-muted-foreground">
              No notification logs found
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-full sm:max-w-2xl mx-4">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Notification Details</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-3 sm:space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-xs sm:text-sm font-medium">Channel</p>
                  <p className="text-xs sm:text-sm text-muted-foreground capitalize">{selectedLog.channel}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium">Status</p>
                  {getStatusBadge(selectedLog.status)}
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium">Event Type</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">{selectedLog.event_type}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium">Created At</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {format(new Date(selectedLog.created_at), "PPpp")}
                  </p>
                </div>
                {selectedLog.recipient && (
                  <div>
                    <p className="text-xs sm:text-sm font-medium">Recipient</p>
                    <p className="text-xs sm:text-sm text-muted-foreground break-all">{selectedLog.recipient}</p>
                  </div>
                )}
                {selectedLog.external_id && (
                  <div>
                    <p className="text-xs sm:text-sm font-medium">External ID</p>
                    <p className="text-xs sm:text-sm text-muted-foreground font-mono break-all">{selectedLog.external_id}</p>
                  </div>
                )}
              </div>
              
              {selectedLog.subject && (
                <div>
                  <p className="text-xs sm:text-sm font-medium">Subject</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">{selectedLog.subject}</p>
                </div>
              )}
              
              <div>
                <p className="text-xs sm:text-sm font-medium mb-2">Message</p>
                <div className="bg-muted p-3 sm:p-4 rounded-md text-xs sm:text-sm break-words">
                  {selectedLog.message_body}
                </div>
              </div>

              {selectedLog.error_message && (
                <div>
                  <p className="text-xs sm:text-sm font-medium text-destructive">Error</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">{selectedLog.error_message}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
