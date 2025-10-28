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
      <Badge variant="outline" className="border-muted-foreground/30">
        <Lock className="w-3 h-3 mr-1" />
        No Portal Access
      </Badge>
    );
  }

  if (status === 'invited' && !lastLoginAt) {
    return (
      <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
        <Mail className="w-3 h-3 mr-1" />
        Invited
      </Badge>
    );
  }

  return (
    <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/30">
      <CheckCircle2 className="w-3 h-3 mr-1" />
      Active Portal
    </Badge>
  );
};
