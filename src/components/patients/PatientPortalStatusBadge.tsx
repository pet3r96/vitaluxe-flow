import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Mail, Lock, Ban } from "lucide-react";

interface PatientPortalStatusBadgeProps {
  userId?: string | null; // The auth.users.id - if null, no account created
  lastLoginAt?: string | null;
  status?: string; // The patient_accounts.status field
}

export const PatientPortalStatusBadge = ({
  userId,
  lastLoginAt,
  status,
}: PatientPortalStatusBadgeProps) => {
  // Check if account is disabled (highest priority)
  if (status === 'disabled') {
    return (
      <Badge variant="destructive" size="sm">
        <Ban className="w-3 h-3 mr-1" />
        Disabled
      </Badge>
    );
  }

  // No portal account created yet
  if (!userId) {
    return (
      <Badge variant="outline" size="sm">
        <Lock className="w-3 h-3 mr-1" />
        No Portal Access
      </Badge>
    );
  }

  // Account created but never logged in (invitation sent but not activated)
  if (!lastLoginAt) {
    return (
      <Badge variant="warning" size="sm">
        <Mail className="w-3 h-3 mr-1" />
        Invitation Sent
      </Badge>
    );
  }

  // Account created and has logged in at least once
  return (
    <Badge variant="success" size="sm">
      <CheckCircle2 className="w-3 h-3 mr-1" />
      Active Portal
    </Badge>
  );
};
