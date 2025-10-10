import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mail, Phone, Building2, Users } from "lucide-react";

interface DownlineDetailsDialogProps {
  downline: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    company: string | null;
    active: boolean;
    practiceCount: number;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DownlineDetailsDialog({
  downline,
  open,
  onOpenChange,
}: DownlineDetailsDialogProps) {
  const { data: practices, isLoading } = useQuery({
    queryKey: ["downline-practices", downline.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, phone, address, active")
        .eq("linked_topline_id", downline.id)
        .eq("active", true);

      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Downline Details</span>
            <Badge variant={downline.active ? "default" : "secondary"}>
              {downline.active ? "Active" : "Inactive"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Downline Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">{downline.name}</h3>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{downline.email}</span>
              </div>
              
              {downline.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{downline.phone}</span>
                </div>
              )}
              
              {downline.company && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{downline.company}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Practices Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">
                Assigned Practices ({downline.practiceCount})
              </h3>
            </div>

            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading practices...</div>
            ) : practices && practices.length > 0 ? (
              <div className="space-y-3">
                {practices.map((practice) => (
                  <div
                    key={practice.id}
                    className="rounded-lg border bg-card p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{practice.name}</span>
                      <Badge variant={practice.active ? "default" : "secondary"} className="text-xs">
                        {practice.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {practice.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-3 w-3" />
                          <span>{practice.email}</span>
                        </div>
                      )}
                      
                      {practice.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          <span>{practice.phone}</span>
                        </div>
                      )}
                      
                      {practice.address && (
                        <div className="flex items-start gap-2">
                          <Building2 className="h-3 w-3 mt-0.5" />
                          <span className="flex-1">{practice.address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-8">
                No practices assigned to this downline yet
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
