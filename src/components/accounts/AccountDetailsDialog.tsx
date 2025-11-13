import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { ExternalLink, Edit2, X, ShieldOff, Mail } from "lucide-react";
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
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting2FA, setIsResetting2FA] = useState(false);
  const [showResendEmailConfirm, setShowResendEmailConfirm] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);

  // Fetch 2FA status
  const { data: twoFAData, refetch: refetch2FA } = useQuery({
    queryKey: ["user-2fa", account?.id],
    queryFn: async () => {
      if (!account?.id) return null;
      const { data, error } = await supabase
        .from('user_2fa_settings')
        .select('*')
        .eq('user_id', account.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!account?.id && open
  });

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
    staleTime: 5 * 60 * 1000, // 5 minutes
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
      // Refetch potential parents when dialog opens
      queryClient.invalidateQueries({ queryKey: ["potential-parents"] });
    }
  }, [open, account, isDownline, queryClient]);

  const handleReset2FA = async () => {
    setIsResetting2FA(true);
    try {
      const { error } = await supabase.functions.invoke('reset-user-2fa', {
        body: { 
          targetUserId: account.id,
          reason: 'Admin reset via account management'
        }
      });

      if (error) throw error;

      toast.success('2FA reset successfully');
      await refetch2FA();
      setShowResetConfirm(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset 2FA');
    } finally {
      setIsResetting2FA(false);
    }
  };

  const maskPhoneNumber = (phone: string) => {
    if (phone?.startsWith('+1')) {
      const digits = phone.slice(2);
      return `***-***-${digits.slice(-4)}`;
    }
    return '***-***-****';
  };

  const handleResendWelcomeEmail = async () => {
    setIsResendingEmail(true);
    try {
      // Call edge function - it handles password generation and update
      const { error: emailError } = await supabase.functions.invoke('send-temp-password-email', {
        body: {
          userId: account.id,
          email: account.email,
          name: account.name,
          role: getDisplayRole(account)
        }
      });

      if (emailError) throw emailError;

      // Log audit event
      await supabase.rpc('log_audit_event', {
        p_action_type: 'welcome_email_resent',
        p_entity_type: 'profiles',
        p_entity_id: account.id,
        p_details: { resent_by: 'admin', email: account.email }
      });

      toast.success('Welcome email resent successfully');
      setShowResendEmailConfirm(false);
    } catch (error: any) {
      console.error('Error resending welcome email:', error);
      toast.error(error.message || 'Failed to resend welcome email');
    } finally {
      setIsResendingEmail(false);
    }
  };

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
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["potential-parents"] });
      
      onSuccess();
    } catch (error: any) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error("Error updating account", error);
      });
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
      <DialogContent className="max-w-[95vw] sm:max-w-2xl">
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

            {/* 2FA Status Section */}
            <div className="col-span-2 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Two-Factor Authentication</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={twoFAData?.is_enrolled ? "default" : "secondary"}>
                      {twoFAData?.is_enrolled ? "Enrolled" : "Not Enrolled"}
                    </Badge>
                    {twoFAData?.phone_number && (
                      <span className="text-sm text-muted-foreground">
                        {maskPhoneNumber(twoFAData.phone_number)}
                      </span>
                    )}
                  </div>
                </div>
                {twoFAData && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowResetConfirm(true)}
                  >
                    <ShieldOff className="h-4 w-4 mr-2" />
                    Reset 2FA
                  </Button>
                )}
              </div>
            </div>

            {/* Welcome Email Section - only show if account was created with temp password */}
            {account.temp_password && (
              <div className="col-span-2 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Welcome Email</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Account was created with a temporary password
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowResendEmailConfirm(true)}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Resend Welcome Email
                  </Button>
                </div>
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

      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Two-Factor Authentication</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear the user's 2FA enrollment. They will be required to re-enroll with a new phone number on their next login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset2FA} disabled={isResetting2FA}>
              {isResetting2FA ? "Resetting..." : "Reset 2FA"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showResendEmailConfirm} onOpenChange={setShowResendEmailConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resend Welcome Email</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate a new temporary password and send a welcome email to <strong>{account?.email}</strong>.
              The user's current password will be replaced with the new temporary password.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleResendWelcomeEmail} 
              disabled={isResendingEmail}
            >
              {isResendingEmail ? "Sending..." : "Resend Email"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};
