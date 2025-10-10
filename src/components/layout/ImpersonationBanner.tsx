import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { X, Eye } from "lucide-react";

const roleLabels: Record<string, string> = {
  doctor: "Practice",
  pharmacy: "Pharmacy",
  topline: "Topline Rep",
  downline: "Downline Rep",
};

export function ImpersonationBanner() {
  const { isImpersonating, impersonatedRole, impersonatedUserName, clearImpersonation } = useAuth();

  if (!isImpersonating || !impersonatedRole) return null;

  const displayName = impersonatedUserName 
    ? `${roleLabels[impersonatedRole] || impersonatedRole} - ${impersonatedUserName}`
    : roleLabels[impersonatedRole] || impersonatedRole;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-primary/90 to-accent/90 text-primary-foreground shadow-gold animate-in slide-in-from-top">
      <div className="container mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4" />
          <span className="text-sm font-medium">
            Viewing as <strong>{displayName}</strong> • You are still authenticated as Admin
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearImpersonation}
          className="h-auto py-1 px-3 text-primary-foreground hover:bg-primary-foreground/20"
        >
          <X className="h-4 w-4 mr-1" />
          Exit Impersonation
        </Button>
      </div>
    </div>
  );
}
