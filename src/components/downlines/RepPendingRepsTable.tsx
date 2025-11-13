import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Loader2 } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PendingRep = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: string;
  created_at: string;
  rejection_reason: string | null;
  admin_notes: string | null;
  company: string | null;
};

export function RepPendingRepsTable() {
  const { effectiveUserId } = useAuth();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedRep, setSelectedRep] = useState<PendingRep | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: pendingReps = [], isLoading } = useQuery({
    queryKey: ["rep-pending-reps", effectiveUserId, selectedStatus],
    queryFn: async () => {
      let query = supabase
        .from("pending_reps")
        .select("*")
        .eq("created_by_user_id", effectiveUserId)
        .order("created_at", { ascending: false });

      // Filter out approved items - they belong in "My Downlines"
      if (selectedStatus === "all") {
        query = query.in("status", ["pending", "rejected"]);
      } else {
        query = query.eq("status", selectedStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PendingRep[];
    },
    enabled: !!effectiveUserId,
  });

  // Realtime subscription for auto-refresh when reps are approved
  useEffect(() => {
    if (!effectiveUserId) return;

    console.debug('[RepPendingRepsTable] Setting up realtime subscription');
    
    const channel = supabase
      .channel('pending-reps-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pending_reps',
          filter: `created_by_user_id=eq.${effectiveUserId}`
        },
        (payload) => {
          console.debug('[RepPendingRepsTable] Received update:', payload);
          
          // If a rep was approved, refresh all related queries
          if (payload.new && (payload.new as any).status === 'approved') {
            console.debug('[RepPendingRepsTable] Rep approved, invalidating queries');
            queryClient.invalidateQueries({ queryKey: ['rep-pending-reps', effectiveUserId] });
            queryClient.invalidateQueries({ queryKey: ['downlines-table', effectiveUserId] });
            queryClient.invalidateQueries({ queryKey: ['downline-count'] });
          } else {
            // For other updates (rejected, etc.), just refresh pending table
            queryClient.invalidateQueries({ queryKey: ['rep-pending-reps', effectiveUserId] });
          }
        }
      )
      .subscribe();

    return () => {
      console.debug('[RepPendingRepsTable] Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [effectiveUserId, queryClient]);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "pending":
        return "secondary";
      case "approved":
        return "default";
      case "rejected":
        return "destructive";
      default:
        return "outline";
    }
  };

  const handleViewDetails = (rep: PendingRep) => {
    setSelectedRep(rep);
    setDetailsOpen(true);
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">My Downline Rep Requests</h2>
        <p className="text-sm text-muted-foreground">
          Track the status of your submitted downline representative requests
        </p>
      </div>

      <Tabs value={selectedStatus} onValueChange={setSelectedStatus}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedStatus} className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rep Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingReps.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No rep requests found
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingReps.map((rep) => (
                    <TableRow key={rep.id}>
                      <TableCell className="font-medium">{rep.full_name}</TableCell>
                      <TableCell>{rep.email}</TableCell>
                      <TableCell>{rep.phone || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(rep.status)}>
                          {rep.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(rep.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(rep)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Rep Request Details</DialogTitle>
            <DialogDescription>
              Full information about this downline representative request
            </DialogDescription>
          </DialogHeader>

          {selectedRep && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <p className="text-sm text-muted-foreground">{selectedRep.full_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <div className="mt-1">
                    <Badge variant={getStatusBadgeVariant(selectedRep.status)}>
                      {selectedRep.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <p className="text-sm text-muted-foreground">{selectedRep.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedRep.phone || "—"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Company</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedRep.company || "—"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Submitted</label>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedRep.created_at), "MMM d, yyyy HH:mm")}
                  </p>
                </div>
              </div>

              {selectedRep.status === "rejected" && selectedRep.rejection_reason && (
                <div>
                  <label className="text-sm font-medium text-destructive">
                    Rejection Reason
                  </label>
                  <p className="text-sm text-muted-foreground">
                    {selectedRep.rejection_reason}
                  </p>
                </div>
              )}

              {selectedRep.admin_notes && (
                <div>
                  <label className="text-sm font-medium">Admin Notes</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedRep.admin_notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
