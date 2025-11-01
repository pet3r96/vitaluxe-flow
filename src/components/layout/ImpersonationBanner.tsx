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
      <div className="container mx-auto px-2 sm:px-4 py-1 sm:py-1.5 flex items-center justify-between gap-2 max-w-full overflow-hidden">
        <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-1">
          <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
          <span className="text-[10px] sm:text-xs font-medium truncate">
            Viewing as <strong className="truncate max-w-[120px] sm:max-w-none inline-block">{displayName}</strong>
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearImpersonation}
          className="h-6 sm:h-7 py-0.5 px-1.5 sm:px-2 text-[10px] sm:text-xs text-primary-foreground hover:bg-primary-foreground/20 flex-shrink-0"
        >
          <X className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-0.5 sm:mr-1" />
          <span>Exit</span>
        </Button>
      </div>
    </div>
  );
}
