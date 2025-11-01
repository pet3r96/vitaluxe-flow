import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Mail, Lock } from "lucide-react";

interface PatientPortalStatusBadgeProps {
  hasPortalAccount: boolean;
  status: 'active' | 'invited' | null;
  lastLoginAt?: string | null;
}

export const PatientPortalStatusBadge = ({
  hasPortalAccount,
  status,
  lastLoginAt,
}: PatientPortalStatusBadgeProps) => {
  if (!hasPortalAccount) {
    return (
      <Badge variant="outline" size="sm">
        <Lock className="w-3 h-3 mr-1" />
        No Portal Access
      </Badge>
    );
  }

  if (status === 'invited' && !lastLoginAt) {
    return (
      <Badge variant="warning" size="sm">
        <Mail className="w-3 h-3 mr-1" />
        Invited
      </Badge>
    );
  }

  return (
    <Badge variant="success" size="sm">
      <CheckCircle2 className="w-3 h-3 mr-1" />
      Active Portal
    </Badge>
  );
};
