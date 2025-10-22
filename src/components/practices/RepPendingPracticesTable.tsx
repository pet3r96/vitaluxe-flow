import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
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

type PendingPractice = {
  id: string;
  practice_name: string;
  email: string;
  npi: string | null;
  status: string;
  created_at: string;
  rejection_reason: string | null;
  admin_notes: string | null;
  phone: string | null;
  license_number: string | null;
  dea: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
};

export function RepPendingPracticesTable() {
  const { effectiveUserId } = useAuth();
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPractice, setSelectedPractice] = useState<PendingPractice | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: pendingPractices = [], isLoading } = useQuery({
    queryKey: ["rep-pending-practices", effectiveUserId, selectedStatus],
    queryFn: async () => {
      let query = supabase
        .from("pending_practices")
        .select("*")
        .eq("created_by_user_id", effectiveUserId)
        .order("created_at", { ascending: false });

      if (selectedStatus !== "all") {
        query = query.eq("status", selectedStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PendingPractice[];
    },
    enabled: !!effectiveUserId,
  });

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

  const handleViewDetails = (practice: PendingPractice) => {
    setSelectedPractice(practice);
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
        <h2 className="text-xl font-semibold">My Practice Requests</h2>
        <p className="text-sm text-muted-foreground">
          Track the status of your submitted practice requests
        </p>
      </div>

      <Tabs value={selectedStatus} onValueChange={setSelectedStatus}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedStatus} className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Practice Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>NPI</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingPractices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No practice requests found
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingPractices.map((practice) => (
                    <TableRow key={practice.id}>
                      <TableCell className="font-medium">
                        {practice.practice_name}
                      </TableCell>
                      <TableCell>{practice.email}</TableCell>
                      <TableCell>{practice.npi || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(practice.status)}>
                          {practice.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(practice.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(practice)}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Practice Request Details</DialogTitle>
            <DialogDescription>
              Full information about this practice request
            </DialogDescription>
          </DialogHeader>

          {selectedPractice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Practice Name</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedPractice.practice_name}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <div className="mt-1">
                    <Badge variant={getStatusBadgeVariant(selectedPractice.status)}>
                      {selectedPractice.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedPractice.email}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedPractice.phone || "—"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">NPI</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedPractice.npi || "—"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">License Number</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedPractice.license_number || "—"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">DEA</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedPractice.dea || "—"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Submitted</label>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedPractice.created_at), "MMM d, yyyy HH:mm")}
                  </p>
                </div>
              </div>

              {(selectedPractice.address_street || selectedPractice.address_city) && (
                <div>
                  <label className="text-sm font-medium">Address</label>
                  <p className="text-sm text-muted-foreground">
                    {[
                      selectedPractice.address_street,
                      selectedPractice.address_city,
                      selectedPractice.address_state,
                      selectedPractice.address_zip
                    ].filter(Boolean).join(", ")}
                  </p>
                </div>
              )}

              {selectedPractice.status === "rejected" && selectedPractice.rejection_reason && (
                <div>
                  <label className="text-sm font-medium text-destructive">
                    Rejection Reason
                  </label>
                  <p className="text-sm text-muted-foreground">
                    {selectedPractice.rejection_reason}
                  </p>
                </div>
              )}

              {selectedPractice.admin_notes && (
                <div>
                  <label className="text-sm font-medium">Admin Notes</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedPractice.admin_notes}
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
