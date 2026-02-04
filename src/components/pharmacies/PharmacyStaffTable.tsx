import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { toast } from "sonner";
import { Loader2, UserPlus, Trash2, Mail } from "lucide-react";
import { AddPharmacyStaffDialog } from "./AddPharmacyStaffDialog";
import { PharmacyStaffMember } from "@/types/pharmacyStaff";

interface PharmacyStaffTableProps {
  pharmacyId: string;
  isOwner: boolean;
}

export const PharmacyStaffTable = ({ pharmacyId, isOwner }: PharmacyStaffTableProps) => {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PharmacyStaffMember | null>(null);

  const { data: staffMembers, isLoading } = useQuery({
    queryKey: ["pharmacy-staff", pharmacyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharmacy_staff")
        .select(`
          *,
          profiles:user_id (
            id,
            full_name,
            email,
            phone
          )
        `)
        .eq("pharmacy_id", pharmacyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as PharmacyStaffMember[];
    },
    enabled: !!pharmacyId,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ staffId, active }: { staffId: string; active: boolean }) => {
      const { error } = await supabase
        .from("pharmacy_staff")
        .update({ active, updated_at: new Date().toISOString() })
        .eq("id", staffId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pharmacy-staff", pharmacyId] });
      toast.success("Staff status updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update staff status");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (staffId: string) => {
      const { error } = await supabase
        .from("pharmacy_staff")
        .delete()
        .eq("id", staffId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pharmacy-staff", pharmacyId] });
      toast.success("Staff member removed");
      setDeleteTarget(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove staff member");
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: async (staff: PharmacyStaffMember) => {
      const { error } = await supabase.functions.invoke('send-welcome-email', {
        body: {
          userId: staff.user_id,
          email: staff.profiles?.email,
          name: staff.profiles?.full_name,
          role: 'pharmacy_staff',
          pharmacyId: pharmacyId
        }
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invitation email resent");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to resend invitation");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isOwner && (
        <div className="flex justify-end">
          <Button onClick={() => setShowAddDialog(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Add Staff Member
          </Button>
        </div>
      )}

      {staffMembers && staffMembers.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Permissions</TableHead>
                {isOwner && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffMembers.map((staff) => (
                <TableRow key={staff.id}>
                  <TableCell className="font-medium">
                    {staff.profiles?.full_name || "—"}
                  </TableCell>
                  <TableCell>{staff.profiles?.email || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{staff.role_type}</Badge>
                  </TableCell>
                  <TableCell>
                    {isOwner ? (
                      <Switch
                        checked={staff.active}
                        onCheckedChange={(checked) =>
                          toggleActiveMutation.mutate({ staffId: staff.id, active: checked })
                        }
                        disabled={toggleActiveMutation.isPending}
                      />
                    ) : (
                      <Badge variant={staff.active ? "default" : "outline"}>
                        {staff.active ? "Active" : "Inactive"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {staff.can_manage_orders && (
                        <Badge variant="outline" className="text-xs">Orders</Badge>
                      )}
                      {staff.can_manage_shipping && (
                        <Badge variant="outline" className="text-xs">Shipping</Badge>
                      )}
                      {staff.can_view_api_config && (
                        <Badge variant="outline" className="text-xs">API</Badge>
                      )}
                    </div>
                  </TableCell>
                  {isOwner && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => resendInviteMutation.mutate(staff)}
                          disabled={resendInviteMutation.isPending}
                          title="Resend invitation"
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(staff)}
                          className="text-destructive hover:text-destructive"
                          title="Remove staff member"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground border rounded-md">
          <p>No staff members yet.</p>
          {isOwner && (
            <p className="text-sm mt-2">
              Add staff members to give them access to your pharmacy dashboard.
            </p>
          )}
        </div>
      )}

      <AddPharmacyStaffDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["pharmacy-staff", pharmacyId] });
        }}
        pharmacyId={pharmacyId}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Staff Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {deleteTarget?.profiles?.full_name || "this staff member"}? 
              They will no longer have access to the pharmacy dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
