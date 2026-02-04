import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { PharmacyStaffTable } from "./PharmacyStaffTable";
import { Loader2 } from "lucide-react";

export const PharmacyTeamSection = () => {
  const { effectiveUserId } = useAuth();

  // Get pharmacy for current user
  const { data: pharmacy, isLoading: pharmacyLoading } = useQuery({
    queryKey: ["pharmacy-for-user", effectiveUserId],
    queryFn: async () => {
      // First check if user is pharmacy owner
      const { data: owned, error: ownedError } = await supabase
        .from("pharmacies")
        .select("id, user_id")
        .eq("user_id", effectiveUserId)
        .maybeSingle();

      if (owned) {
        return { ...owned, isOwner: true };
      }

      // Check if user is pharmacy staff
      const { data: staff, error: staffError } = await supabase
        .from("pharmacy_staff")
        .select("pharmacy_id, active")
        .eq("user_id", effectiveUserId)
        .eq("active", true)
        .maybeSingle();

      if (staff?.pharmacy_id) {
        return { id: staff.pharmacy_id, user_id: null, isOwner: false };
      }

      return null;
    },
    enabled: !!effectiveUserId,
  });

  if (pharmacyLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!pharmacy) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team Management
        </CardTitle>
        <CardDescription>
          {pharmacy.isOwner 
            ? "Add and manage staff members who can access your pharmacy dashboard"
            : "View other members of your pharmacy team"
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PharmacyStaffTable 
          pharmacyId={pharmacy.id} 
          isOwner={pharmacy.isOwner} 
        />
      </CardContent>
    </Card>
  );
};
