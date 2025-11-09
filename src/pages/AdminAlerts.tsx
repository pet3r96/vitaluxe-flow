import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const AdminAlerts = () => {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [resolvedFilter, setResolvedFilter] = useState<string>("unresolved");
  const [detailsDialog, setDetailsDialog] = useState<any>(null);
  const navigate = useNavigate();

  const { data: alerts, refetch } = useQuery({
    queryKey: ["admin-alerts", typeFilter, severityFilter, resolvedFilter],
    queryFn: async () => {
      let query = supabase
        .from("admin_alerts")
        .select(`
          *,
          pharmacies (id, name)
        `)
        .order("created_at", { ascending: false });

      if (typeFilter !== "all") {
        query = query.eq("alert_type", typeFilter);
      }
      if (severityFilter !== "all") {
        query = query.eq("severity", severityFilter);
      }
      if (resolvedFilter === "resolved") {
        query = query.eq("resolved", true);
      } else if (resolvedFilter === "unresolved") {
        query = query.eq("resolved", false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const handleResolve = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from("admin_alerts")
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq("id", alertId);

      if (error) throw error;
      toast.success("Alert resolved");
      refetch();
    } catch (error: any) {
      toast.error("Failed to resolve alert: " + error.message);
    }
  };

  const handleViewLogs = (pharmacyId: string) => {
    navigate(`/admin/pharmacy-api-logs?pharmacy=${pharmacyId}`);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">System Alerts</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          Monitor pharmacy API health and tracking issues
        </p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="pharmacy_api_down">API Down</SelectItem>
            <SelectItem value="missing_tracking_updates">Missing Tracking</SelectItem>
            <SelectItem value="high_failure_rate">High Failure Rate</SelectItem>
          </SelectContent>
        </Select>

        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All Severities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
          </SelectContent>
        </Select>

        <Select value={resolvedFilter} onValueChange={setResolvedFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unresolved">Unresolved</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alerts Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-destructive/10 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-5 w-5 text-destructive" />
            <span className="font-semibold">Critical</span>
          </div>
          <div className="text-2xl font-bold">
            {alerts?.filter(a => a.severity === 'critical' && !a.resolved).length || 0}
          </div>
        </div>

        <div className="p-4 bg-yellow-500/10 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            <span className="font-semibold">Warning</span>
          </div>
          <div className="text-2xl font-bold">
            {alerts?.filter(a => a.severity === 'warning' && !a.resolved).length || 0}
          </div>
        </div>

        <div className="p-4 bg-green-500/10 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span className="font-semibold">Resolved (24h)</span>
          </div>
          <div className="text-2xl font-bold">
            {alerts?.filter(a => 
              a.resolved && a.resolved_at && 
              new Date(a.resolved_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
            ).length || 0}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Severity</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Pharmacy</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts?.map((alert) => (
              <TableRow key={alert.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getSeverityIcon(alert.severity)}
                    <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                      {alert.severity}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {alert.alert_type.replace(/_/g, ' ')}
                  </Badge>
                </TableCell>
                <TableCell>{(alert.pharmacies as any)?.name || 'Unknown'}</TableCell>
                <TableCell className="max-w-md truncate">{alert.message}</TableCell>
                <TableCell className="text-sm">
                  {format(new Date(alert.created_at), "MMM d, yyyy HH:mm")}
                </TableCell>
                <TableCell>
                  {alert.resolved ? (
                    <Badge className="bg-green-500">
                      <CheckCircle className="w-3 h-3 mr-1" />Resolved
                    </Badge>
                  ) : (
                    <Badge variant="outline">Active</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button onClick={() => setDetailsDialog(alert)} variant="ghost" size="sm">
                      Details
                    </Button>
                    {!alert.resolved && (
                      <Button onClick={() => handleResolve(alert.id)} variant="ghost" size="sm">
                        Resolve
                      </Button>
                    )}
                    {alert.pharmacy_id && (
                      <Button onClick={() => handleViewLogs(alert.pharmacy_id)} variant="ghost" size="sm">
                        View Logs
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Details Dialog */}
      <Dialog open={!!detailsDialog} onOpenChange={() => setDetailsDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detailsDialog?.title}</DialogTitle>
            <DialogDescription>
              {detailsDialog && format(new Date(detailsDialog.created_at), "PPpp")}
            </DialogDescription>
          </DialogHeader>
          {detailsDialog && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Message</h4>
                <p className="text-sm">{detailsDialog.message}</p>
              </div>
              {detailsDialog.metadata && (
                <div>
                  <h4 className="font-semibold mb-2">Details</h4>
                  <pre className="bg-muted p-4 rounded text-xs overflow-auto max-h-64">
                    {JSON.stringify(detailsDialog.metadata, null, 2)}
                  </pre>
                </div>
              )}
              {detailsDialog.resolved && (
                <div>
                  <h4 className="font-semibold mb-2">Resolution</h4>
                  <p className="text-sm">
                    Resolved at {format(new Date(detailsDialog.resolved_at), "PPpp")}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAlerts;
