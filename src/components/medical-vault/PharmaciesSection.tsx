import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Plus, Edit, Eye, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface PharmaciesSectionProps {
  patientAccountId?: string;
}

export function PharmaciesSection({ patientAccountId }: PharmaciesSectionProps) {
  const { data: pharmacies } = useQuery({
    queryKey: ["patient-pharmacies", patientAccountId],
    queryFn: async () => {
      if (!patientAccountId) return [];
      const { data, error } = await supabase
        .from("patient_pharmacies")
        .select("*")
        .eq("patient_account_id", patientAccountId)
        .order("is_preferred", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!patientAccountId,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Pharmacy
          </CardTitle>
          <Button size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {pharmacies && pharmacies.length > 0 ? (
          <div className="space-y-3">
            {pharmacies.map((pharmacy) => (
              <div key={pharmacy.id} className="flex items-start justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{pharmacy.pharmacy_name}</p>
                    {pharmacy.is_preferred && (
                      <Badge variant="secondary" className="text-xs">
                        <Star className="h-3 w-3 mr-1" />
                        Preferred
                      </Badge>
                    )}
                  </div>
                  {pharmacy.address && (
                    <p className="text-sm text-muted-foreground">
                      {pharmacy.address}, {pharmacy.city}, {pharmacy.state} {pharmacy.zip_code}
                    </p>
                  )}
                  {pharmacy.phone && (
                    <p className="text-sm text-muted-foreground">{pharmacy.phone}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost">
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            No pharmacies recorded
          </p>
        )}
      </CardContent>
    </Card>
  );
}
