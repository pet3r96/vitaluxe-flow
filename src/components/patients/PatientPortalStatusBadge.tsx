import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Mail, Lock } from "lucide-react";

interface PatientPortalStatusBadgeProps {
  userId?: string | null; // The auth.users.id - if null, no account created
  lastLoginAt?: string | null;
}

export const PatientPortalStatusBadge = ({
  userId,
  lastLoginAt,
}: PatientPortalStatusBadgeProps) => {
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
