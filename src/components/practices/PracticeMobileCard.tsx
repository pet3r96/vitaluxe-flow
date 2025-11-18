import { Eye, Power, PowerOff, FileText, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { memo } from "react";
import { formatPhoneNumber } from "@/lib/validators";

interface PracticeMobileCardProps {
  practice: any;
  onViewDetails: (practice: any) => void;
  onToggleStatus: (practiceId: string, currentStatus: boolean) => Promise<void>;
  canViewCredentials: boolean;
}

export const PracticeMobileCard = memo(({ 
  practice, 
  onViewDetails, 
  onToggleStatus,
  canViewCredentials 
}: PracticeMobileCardProps) => {
  const providersCount = practice.providers_count || 0;

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-card hover:bg-accent/5 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{practice.name}</div>
          <div className="text-xs text-muted-foreground mt-1 truncate">
            {practice.email}
          </div>
        </div>
        <Badge variant={practice.active ? "default" : "secondary"} className="shrink-0">
          {practice.active ? "Active" : "Inactive"}
        </Badge>
      </div>

      <div className="space-y-2 text-sm">
        {canViewCredentials && (practice.npi || practice.license_number) && (
          <>
            {practice.npi && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">NPI:</span>
                <span className="font-mono text-xs">{practice.npi}</span>
              </div>
            )}
            {practice.license_number && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">License #:</span>
                <span className="font-mono text-xs">{practice.license_number}</span>
              </div>
            )}
          </>
        )}
        
        {practice.phone && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Phone:</span>
            <span>{formatPhoneNumber(practice.phone)}</span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-muted-foreground">Prescriber:</span>
          <Badge variant={practice.prescriber_status === "approved" ? "default" : "secondary"} className="text-xs">
            {practice.prescriber_status || "pending"}
          </Badge>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">Providers:</span>
          <div className="flex items-center gap-1">
            <Package className="h-3 w-3 text-muted-foreground" />
            <span>{providersCount}</span>
          </div>
        </div>

        {practice.rep_assignment?.profiles?.name && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rep:</span>
            <span className="text-xs">{practice.rep_assignment.profiles.name}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2 border-t">
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1"
          onClick={() => onViewDetails(practice)}
        >
          <Eye className="h-3.5 w-3.5 mr-1" />
          View
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onToggleStatus(practice.id, practice.active)}
        >
          {practice.active ? (
            <PowerOff className="h-3.5 w-3.5" />
          ) : (
            <Power className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
});

PracticeMobileCard.displayName = "PracticeMobileCard";
