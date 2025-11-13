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
  // Safety check: gracefully handle if auth context not available
  let isImpersonating = false;
  let impersonatedRole = null;
  let impersonatedUserName = null;
  let clearImpersonation = () => {};

  try {
    const auth = useAuth();
    isImpersonating = auth.isImpersonating || false;
    impersonatedRole = auth.impersonatedRole;
    impersonatedUserName = auth.impersonatedUserName;
    clearImpersonation = auth.clearImpersonation;
  } catch (error) {
    // Auth context not available - this is OK, just don't render banner
    return null;
  }

  if (!isImpersonating || !impersonatedRole) return null;

  const displayName = impersonatedUserName 
    ? `${roleLabels[impersonatedRole] || impersonatedRole} - ${impersonatedUserName}`
    : roleLabels[impersonatedRole] || impersonatedRole;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-600 dark:bg-amber-700 shadow-lg border-b border-amber-700 dark:border-amber-800">
      <div className="container mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-3 max-w-full">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Eye className="h-4 w-4 flex-shrink-0 text-white" />
          <span className="text-xs sm:text-sm font-medium text-white">
            Viewing as <strong className="font-semibold">{displayName}</strong>
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearImpersonation}
          className="h-7 sm:h-8 px-2 sm:px-3 text-xs font-medium text-white hover:bg-white/20 flex-shrink-0 border border-white/30"
        >
          <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
          <span>Exit</span>
        </Button>
      </div>
    </div>
  );
}
