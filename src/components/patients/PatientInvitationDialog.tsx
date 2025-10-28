import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Mail, Shield, UserPlus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

interface PatientInvitationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientIds: string[];
  onSuccess: () => void;
}

export const PatientInvitationDialog = ({
  open,
  onOpenChange,
  patientIds,
  onSuccess,
}: PatientInvitationDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);

  // Check 2FA status when dialog opens
  useState(() => {
    if (open) {
      supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'two_fa_enforcement_enabled')
        .maybeSingle()
        .then(({ data }) => {
          setTwoFAEnabled(data?.setting_value === 'true');
        });
    }
  });

  const handleInvite = async () => {
    setLoading(true);
    setProgress(0);

    try {
      const { data, error } = await supabase.functions.invoke('bulk-invite-patients', {
        body: { patientIds },
      });

      if (error) throw error;

      setProgress(100);

      if (data.successful > 0) {
        toast.success(
          `Successfully invited ${data.successful} patient${data.successful > 1 ? 's' : ''}`
        );
      }

      if (data.failed > 0) {
        toast.error(
          `Failed to invite ${data.failed} patient${data.failed > 1 ? 's' : ''}`,
          {
            description: data.errors.slice(0, 3).map((e: any) => e.error).join(', '),
          }
        );
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Bulk invitation error:', error);
      toast.error('Failed to send invitations', {
        description: error.message,
      });
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Patients to Portal</DialogTitle>
          <DialogDescription>
            You're about to invite {patientIds.length} patient{patientIds.length > 1 ? 's' : ''} to the patient portal
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <Mail className="w-4 h-4 mt-0.5 text-primary" />
              <p className="text-sm">Each patient will receive a welcome email</p>
            </div>
            <div className="flex items-start gap-2">
              <UserPlus className="w-4 h-4 mt-0.5 text-primary" />
              <p className="text-sm">They'll get temporary login credentials</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary" />
              <p className="text-sm">Be prompted to set a new password</p>
            </div>
            {twoFAEnabled && (
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 mt-0.5 text-primary" />
                <p className="text-sm">Need to set up 2FA on first login</p>
              </div>
            )}
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Patients without valid email addresses will be skipped
            </AlertDescription>
          </Alert>

          {loading && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Sending invitations...</p>
              <Progress value={progress} className="w-full" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleInvite} disabled={loading}>
            {loading ? 'Sending...' : 'Send Invitations'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
