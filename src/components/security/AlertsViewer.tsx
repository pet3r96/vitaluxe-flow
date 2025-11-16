import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Alert {
  id: string;
  rule_id: string | null;
  event_type: string;
  severity: string;
  message: string;
  details: any;
  notification_sent: boolean;
  notification_error: string | null;
  triggered_at: string;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  notes: string | null;
}

export const AlertsViewer = () => {
  const queryClient = useQueryClient();
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);

  const { data: unresolvedAlerts, isLoading: loadingUnresolved } = useQuery({
    queryKey: ["alerts", "unresolved"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("resolved", false)
        .order("triggered_at", { ascending: false });
      
      if (error) throw error;
      return data as Alert[];
    },
  });

  const { data: resolvedAlerts, isLoading: loadingResolved } = useQuery({
    queryKey: ["alerts", "resolved"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("resolved", true)
        .order("resolved_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as Alert[];
    },
  });

  const resolveAlertMutation = useMutation({
    mutationFn: async ({ alertId, notes }: { alertId: string; notes: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("alerts")
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: userData.user?.id,
          notes: notes || null,
        })
        .eq("id", alertId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Alert marked as resolved");
      setIsResolveDialogOpen(false);
      setSelectedAlert(null);
      setResolveNotes("");
    },
    onError: (error) => {
      toast.error("Failed to resolve alert");
      console.error("Failed to resolve alert:", error);
    },
  });

  const deleteAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from("alerts")
        .delete()
        .eq("id", alertId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Alert deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete alert");
      console.error("Failed to delete alert:", error);
    },
  });

  const markAllResolvedMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("alerts")
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: userData.user?.id,
        })
        .eq("resolved", false);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("All alerts marked as resolved");
    },
    onError: (error) => {
      toast.error("Failed to mark all as resolved");
      console.error("Failed to mark all as resolved:", error);
    },
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "destructive";
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "default";
    }
  };

  const formatEventType = (eventType: string) => {
    return eventType
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const AlertTable = ({ alerts, showResolvedInfo = false }: { alerts: Alert[] | undefined; showResolvedInfo?: boolean }) => {
    if (!alerts || alerts.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <AlertTriangle className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium mb-2">No Alerts</p>
          <p className="text-sm">
            {showResolvedInfo ? "No resolved alerts to display." : "All alerts have been resolved."}
          </p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Event Type</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Message</TableHead>
            {showResolvedInfo && <TableHead>Resolved</TableHead>}
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.map((alert) => (
            <TableRow key={alert.id}>
              <TableCell className="text-sm">
                {new Date(alert.triggered_at).toLocaleString()}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{formatEventType(alert.event_type)}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={getSeverityColor(alert.severity)}>
                  {alert.severity}
                </Badge>
              </TableCell>
              <TableCell className="max-w-md">
                <div>
                  <div className="font-medium">{alert.message}</div>
                  {alert.details && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {JSON.stringify(alert.details, null, 2).substring(0, 100)}...
                    </div>
                  )}
                </div>
              </TableCell>
              {showResolvedInfo && (
                <TableCell className="text-sm text-muted-foreground">
                  {alert.resolved_at && new Date(alert.resolved_at).toLocaleString()}
                  {alert.notes && (
                    <div className="text-xs mt-1">{alert.notes}</div>
                  )}
                </TableCell>
              )}
              <TableCell className="text-right space-x-2">
                {!alert.resolved && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedAlert(alert);
                      setIsResolveDialogOpen(true);
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Resolve
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this alert?")) {
                      deleteAlertMutation.mutate(alert.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Alerts Management
              </CardTitle>
              <CardDescription>
                View and manage system alerts and notifications
              </CardDescription>
            </div>
            {unresolvedAlerts && unresolvedAlerts.length > 0 && (
              <Button
                onClick={() => {
                  if (confirm("Mark all unresolved alerts as resolved?")) {
                    markAllResolvedMutation.mutate();
                  }
                }}
                disabled={markAllResolvedMutation.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Resolve All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="unresolved">
            <TabsList className="mb-4">
              <TabsTrigger value="unresolved">
                Unresolved
                {unresolvedAlerts && unresolvedAlerts.length > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {unresolvedAlerts.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="resolved">Resolved</TabsTrigger>
            </TabsList>

            <TabsContent value="unresolved">
              {loadingUnresolved ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <AlertTable alerts={unresolvedAlerts} />
              )}
            </TabsContent>

            <TabsContent value="resolved">
              {loadingResolved ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <AlertTable alerts={resolvedAlerts} showResolvedInfo />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isResolveDialogOpen} onOpenChange={setIsResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Alert</DialogTitle>
            <DialogDescription>
              Add optional notes about how this alert was resolved
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedAlert && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="font-medium">{selectedAlert.message}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {formatEventType(selectedAlert.event_type)} • {selectedAlert.severity}
                </div>
              </div>
            )}
            <div>
              <Label>Resolution Notes (Optional)</Label>
              <Textarea
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                placeholder="Describe how this alert was resolved..."
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  if (selectedAlert) {
                    resolveAlertMutation.mutate({
                      alertId: selectedAlert.id,
                      notes: resolveNotes,
                    });
                  }
                }}
                disabled={resolveAlertMutation.isPending}
                className="flex-1"
              >
                {resolveAlertMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Mark as Resolved
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsResolveDialogOpen(false);
                  setSelectedAlert(null);
                  setResolveNotes("");
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};