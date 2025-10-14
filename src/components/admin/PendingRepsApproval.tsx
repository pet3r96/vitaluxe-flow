import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import { Check, X, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const PendingRepsApproval = () => {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("pending");

  type PendingRepWithProfiles = {
    id: string;
    created_by_user_id: string;
    created_by_role: string;
    full_name: string;
    email: string;
    phone: string | null;
    company: string | null;
    role: string;
    assigned_topline_user_id: string | null;
    status: string;
    submitted_at: string;
    reviewed_at: string | null;
    reviewed_by: string | null;
    rejection_reason: string | null;
    admin_notes: string | null;
    created_at: string;
    updated_at: string;
    created_by?: { name: string; email: string } | null;
    reviewed_by_profile?: { name: string } | null;
  };

  const { data: pendingReps, isLoading } = useQuery<PendingRepWithProfiles[]>({
    queryKey: ["pending-reps", statusFilter],
    staleTime: 0,
    queryFn: async () => {
      let query = supabase
        .from("pending_reps")
        .select("*")
        .order("submitted_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch related profiles separately
      if (data && data.length > 0) {
        const creatorIds = [...new Set(data.map(r => r.created_by_user_id))];
        const reviewerIds = [...new Set(data.map(r => r.reviewed_by).filter(Boolean))];
        
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name, email")
          .in("id", [...creatorIds, ...reviewerIds]);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        return data.map(request => ({
          ...request,
          created_by: profileMap.get(request.created_by_user_id),
          reviewed_by_profile: request.reviewed_by ? profileMap.get(request.reviewed_by) : null,
        }));
      }

      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ requestId, adminNotes }: { requestId: string; adminNotes: string }) => {
      const { data, error } = await supabase.functions.invoke("approve-pending-rep", {
        body: { requestId, action: "approve", adminNotes },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Representative approved successfully");
      if (data?.tempPassword) {
        toast.info(`Temporary password: ${data.tempPassword}`, { duration: 10000 });
      }
      queryClient.invalidateQueries({ queryKey: ["pending-reps"] });
      setApproveDialogOpen(false);
      setSelectedRequest(null);
      setAdminNotes("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to approve representative");
      
      // Log error to database
      supabase.functions.invoke('log-error', {
        body: {
          action_type: 'client_error',
          entity_type: 'pending_rep_approval',
          entity_id: selectedRequest?.id,
          details: {
            error_message: error.message,
            error_stack: error.stack,
            rep_name: selectedRequest?.full_name,
            rep_email: selectedRequest?.email,
            action: 'approve',
            user_role: 'admin'
          }
        }
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, rejectionReason, adminNotes }: { requestId: string; rejectionReason: string; adminNotes: string }) => {
      const { data, error } = await supabase.functions.invoke("approve-pending-rep", {
        body: { requestId, action: "reject", rejectionReason, adminNotes },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Request rejected");
      queryClient.invalidateQueries({ queryKey: ["pending-reps"] });
      setRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectionReason("");
      setAdminNotes("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to reject request");
      
      // Log error to database
      supabase.functions.invoke('log-error', {
        body: {
          action_type: 'client_error',
          entity_type: 'pending_rep_rejection',
          entity_id: selectedRequest?.id,
          details: {
            error_message: error.message,
            error_stack: error.stack,
            rep_name: selectedRequest?.full_name,
            rep_email: selectedRequest?.email,
            action: 'reject',
            user_role: 'admin'
          }
        }
      });
    },
  });

  const handleApprove = (request: any) => {
    setSelectedRequest(request);
    setAdminNotes("");
    setApproveDialogOpen(true);
  };

  const handleReject = (request: any) => {
    setSelectedRequest(request);
    setRejectionReason("");
    setAdminNotes("");
    setRejectDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">Pending</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Approved</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={statusFilter} className="mt-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Rep Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingReps?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      No requests found
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingReps?.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{request.created_by?.name}</div>
                          <div className="text-sm text-muted-foreground">{request.created_by?.email}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{request.full_name}</TableCell>
                      <TableCell>{request.email}</TableCell>
                      <TableCell>{request.phone || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{request.role}</Badge>
                      </TableCell>
                      <TableCell>{request.company || "-"}</TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell>{format(new Date(request.submitted_at), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        {request.status === "pending" && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 hover:text-green-700"
                              onClick={() => handleApprove(request)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleReject(request)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Representative Request</DialogTitle>
            <DialogDescription>
              Confirm approval for {selectedRequest?.full_name}. This will create their account and send them credentials.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin_notes">Admin Notes (Optional)</Label>
              <Textarea
                id="admin_notes"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add any internal notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => approveMutation.mutate({ requestId: selectedRequest?.id, adminNotes })}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? "Approving..." : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Representative Request</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting {selectedRequest?.full_name}'s request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rejection_reason">Rejection Reason *</Label>
              <Textarea
                id="rejection_reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this request is being rejected..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin_notes_reject">Admin Notes (Optional)</Label>
              <Textarea
                id="admin_notes_reject"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add any internal notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate({ requestId: selectedRequest?.id, rejectionReason, adminNotes })}
              disabled={rejectMutation.isPending || !rejectionReason}
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};