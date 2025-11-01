import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { X, Eye } from "lucide-react";

const roleLabels: Record<string, string> = {
  doctor: "Practice",
  pharmacy: "Pharmacy",
  topline: "Topline Rep",
  downline: "Downline Rep",
  patient: "Patient",
  staff: "Staff Member",
};

export function ImpersonationBanner() {
  const { isImpersonating, impersonatedRole, impersonatedUserName, clearImpersonation } = useAuth();

  if (!isImpersonating || !impersonatedRole) return null;

  const displayName = impersonatedUserName 
    ? `${roleLabels[impersonatedRole] || impersonatedRole} - ${impersonatedUserName}`
    : roleLabels[impersonatedRole] || impersonatedRole;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-primary/90 to-accent/90 text-primary-foreground shadow-gold animate-in slide-in-from-top">
      <div className="container mx-auto px-2 sm:px-4 py-1.5 sm:py-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
          <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
          <span className="text-xs sm:text-sm font-medium truncate">
            Viewing as <strong className="truncate">{displayName}</strong>
            <span className="hidden sm:inline"> • Admin</span>
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearImpersonation}
          className="h-auto py-0.5 px-2 sm:py-1 sm:px-3 text-xs sm:text-sm text-primary-foreground hover:bg-primary-foreground/20 flex-shrink-0 self-end sm:self-auto"
        >
          <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
          <span className="hidden xs:inline">Exit</span>
        </Button>
      </div>
    </div>
  );
}
