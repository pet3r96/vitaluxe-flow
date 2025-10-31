import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Plus, Edit, Eye, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

interface PharmaciesSectionProps {
  patientAccountId?: string;
}

export function PharmaciesSection({ patientAccountId }: PharmaciesSectionProps) {
  const [expanded, setExpanded] = useState(false);
  
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
  
  const visiblePharmacies = expanded 
    ? (pharmacies || []) 
    : (pharmacies || []).slice(0, 2);

  return (
    <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-indigo-500/10 to-blue-500/5 backdrop-blur-sm shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
      {/* Animated border glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <CardHeader className="relative z-10">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-500 shadow-lg">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <span className="bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent font-bold">
              Pharmacy
            </span>
          </CardTitle>
          <Button 
            size="sm" 
            className="bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all duration-300"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        {pharmacies && pharmacies.length > 0 ? (
          <div className="space-y-3">
            {visiblePharmacies.map((pharmacy) => (
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
            {pharmacies.length > 2 && (
              <div className="flex justify-end pt-2">
                <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
                  {expanded ? "Show less" : "Show more"}
                </Button>
              </div>
            )}
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
