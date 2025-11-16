import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";
import { Check, X, Eye } from "lucide-react";
import { PendingProductEditDialog } from "./PendingProductEditDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { getCurrentCSRFToken } from "@/lib/csrf";

export const PendingProductsApproval = () => {
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: requests, refetch } = useQuery({
    queryKey: ["pending-product-requests", activeTab],
    queryFn: async () => {
      let query = supabase
        .from("pending_product_requests")
        .select(`
          *,
          product_types (
            id,
            name
          )
        `)
        .order("submitted_at", { ascending: false });

      if (activeTab !== "all") {
        query = query.eq("status", activeTab);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch pharmacy and user info for each request
      const enrichedData = await Promise.all(
        data.map(async (request) => {
          const { data: pharmacy } = await supabase
            .from("pharmacies")
            .select("name")
            .eq("id", request.pharmacy_id)
            .single();

          const { data: userData } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", request.created_by_user_id)
            .single();

          return {
            ...request,
            pharmacy_name: pharmacy?.name || "Unknown",
            user_name: userData?.full_name || userData?.email || "Unknown",
          };
        })
      );

      return enrichedData;
    },
  });

  const handleReject = async () => {
    if (!selectedRequest || !rejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a rejection reason",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const csrfToken = await getCurrentCSRFToken();

      const { error } = await supabase.functions.invoke(
        "approve-pending-product",
        {
          body: {
            requestId: selectedRequest.id,
            action: "reject",
            rejectionReason,
          },
          headers: {
            "x-csrf-token": csrfToken || "",
          },
        }
      );

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product request rejected",
      });

      setRejectDialogOpen(false);
      setRejectionReason("");
      setSelectedRequest(null);
      refetch();
    } catch (error: any) {
      console.error("Error rejecting request:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to reject request",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="warning" size="sm">Pending</Badge>;
      case "approved":
        return <Badge variant="success" size="sm">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive" size="sm">Rejected</Badge>;
      default:
        return <Badge variant="outline" size="sm">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pharmacy</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Dosage</TableHead>
                  <TableHead>VitaLuxe Price</TableHead>
                  <TableHead>Product Type</TableHead>
                  <TableHead>Rx</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center">
                      No product requests found
                    </TableCell>
                  </TableRow>
                ) : (
                  requests?.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        {request.pharmacy_name}
                      </TableCell>
                      <TableCell>{request.user_name}</TableCell>
                      <TableCell>{request.name}</TableCell>
                      <TableCell>{request.dosage || "-"}</TableCell>
                      <TableCell>${request.vitaluxe_price}</TableCell>
                      <TableCell>
                        {request.product_type_name ? (
                          <Badge variant="outline">
                            New: {request.product_type_name}
                          </Badge>
                        ) : (
                          request.product_types?.name || "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {request.requires_prescription ? (
                          <Badge>Rx</Badge>
                        ) : (
                          <Badge variant="outline">No Rx</Badge>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell>
                        {formatDistanceToNow(new Date(request.submitted_at), {
                          addSuffix: true,
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {request.status === "pending" ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setEditDialogOpen(true);
                                }}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Review
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setRejectDialogOpen(true);
                                }}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedRequest(request);
                                setEditDialogOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {selectedRequest && (
        <PendingProductEditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          request={selectedRequest}
          onSuccess={refetch}
        />
      )}

      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Product Request</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting this product request. The
              pharmacy will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejection_reason">Rejection Reason *</Label>
            <Textarea
              id="rejection_reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter reason for rejection..."
              rows={4}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={loading || !rejectionReason.trim()}
            >
              Reject Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
