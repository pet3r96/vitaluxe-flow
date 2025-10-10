import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ExternalLink, Edit2, X } from "lucide-react";
import { toast } from "sonner";

interface AccountDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: any;
  onSuccess: () => void;
}

export const AccountDetailsDialog = ({
  open,
  onOpenChange,
  account,
  onSuccess,
}: AccountDetailsDialogProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const getDisplayRole = (account: any): string => {
    const baseRole = account.user_roles?.[0]?.role;
    
    if (baseRole === 'doctor') {
      return account.isProvider ? 'provider' : 'practice';
    }
    
    return baseRole || 'No role';
  };

  const role = account?.user_roles?.[0]?.role;
  const isDownline = role === 'downline';
  const isTopline = role === 'topline';
  const isRep = isDownline || isTopline;

  // Fetch potential parent options based on role
  const { data: potentialParents } = useQuery({
    queryKey: ["potential-parents", role],
    queryFn: async () => {
      if (!isRep) return [];

      if (isDownline) {
        // Query profiles instead of reps - matches AddAccountDialog pattern
        const { data: toplines } = await supabase
          .from("profiles")
          .select(`
            id,
            name,
            email,
            user_roles!inner(role)
          `)
          .eq("user_roles.role", "topline")
          .eq("active", true)
          .order("name", { ascending: true });
        
        return toplines?.map(t => ({
          id: t.id,  // This is user_id, matching profiles.linked_topline_id
          name: t.name,
          email: t.email,
        })) || [];
      }

      return [];
    },
    enabled: isRep && open,
  });

  // Set initial parent value when dialog opens
  useEffect(() => {
    if (open && account) {
      if (isDownline) {
        setSelectedParentId(account.linked_topline_id || "none");
      }
    }
  }, [open, account, isDownline]);

  const handleSave = async () => {
    if (!account) return;

    setIsSaving(true);
    try {
      const updates: any = {};

      if (isDownline) {
        updates.linked_topline_id = selectedParentId === "none" ? null : selectedParentId;

        // Also update the reps table
        const { data: repData } = await supabase
          .from("reps")
          .select("id")
          .eq("user_id", account.id)
          .maybeSingle();

        if (repData) {
          // Get topline rep id from user_id
          let toplineRepId = null;
          if (selectedParentId && selectedParentId !== "none") {
            const { data: toplineData } = await supabase
              .from("reps")
              .select("id")
              .eq("user_id", selectedParentId)
              .maybeSingle();
            toplineRepId = toplineData?.id;
          }

          await supabase
            .from("reps")
            .update({ assigned_topline_id: toplineRepId })
            .eq("id", repData.id);
        }
      }

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", account.id);

      if (error) throw error;

      toast.success("Account updated successfully");
      setIsEditing(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error updating account:", error);
      toast.error(error.message || "Failed to update account");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) setIsEditing(false);
      onOpenChange(open);
    }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Account Details</DialogTitle>
              <DialogDescription>View and manage account information</DialogDescription>
            </div>
            {isRep && !isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Parent
              </Button>
            )}
            {isEditing && (
              <Button
                variant="ghost"
                size="sm"
              onClick={() => {
                setIsEditing(false);
                if (isDownline) {
                  setSelectedParentId(account.linked_topline_id || "none");
                }
              }}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{account.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{account.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Role</p>
              <Badge>{getDisplayRole(account)}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={account.active ? "default" : "secondary"}>
                {account.active ? "Active" : "Inactive"}
              </Badge>
            </div>
            {account.company && (
              <div>
                <p className="text-sm text-muted-foreground">Company</p>
                <p className="font-medium">{account.company}</p>
              </div>
            )}
            {account.phone && (
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{account.phone}</p>
              </div>
            )}
            {account.address && (
              <div className="col-span-2">
                <p className="text-sm text-muted-foreground">Address</p>
                <p className="font-medium">{account.address}</p>
              </div>
            )}
            {account.npi && (
              <div>
                <p className="text-sm text-muted-foreground">NPI</p>
                <p className="font-medium">{account.npi}</p>
              </div>
            )}
            {account.dea && (
              <div>
                <p className="text-sm text-muted-foreground">DEA</p>
                <p className="font-medium">{account.dea}</p>
              </div>
            )}
            {account.license_number && (
              <div>
                <p className="text-sm text-muted-foreground">License Number</p>
                <p className="font-medium">{account.license_number}</p>
              </div>
            )}
          </div>

          {/* Parent/Topline Assignment Section for Reps */}
          {isRep && (
            <div className="border-t pt-4">
              <Label className="text-sm font-medium">
                {isDownline ? "Assigned Topline" : "Parent Company"}
              </Label>
              {isEditing ? (
                <div className="mt-2">
                  <Select
                    value={selectedParentId}
                    onValueChange={setSelectedParentId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {potentialParents?.map((parent) => (
                        <SelectItem key={parent.id} value={parent.id}>
                          {parent.name} ({parent.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="mt-2">
                  {isDownline && account.linked_topline ? (
                    <p className="text-sm font-medium">
                      {account.linked_topline.name} ({account.linked_topline.email})
                    </p>
                  ) : account.parent ? (
                    <p className="text-sm font-medium">
                      {account.parent.name} ({account.parent.email})
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not assigned</p>
                  )}
                </div>
              )}
            </div>
          )}

          {account.contract_url && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Contract</p>
              <Button variant="outline" asChild>
                <a href={account.contract_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Contract
                </a>
              </Button>
            </div>
          )}
        </div>

        {isEditing && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditing(false);
                if (isDownline) {
                  setSelectedParentId(account.linked_topline_id || "none");
                }
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
