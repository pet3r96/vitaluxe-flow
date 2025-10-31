import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Syringe, Plus, Edit, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useState } from "react";

interface ImmunizationsSectionProps {
  patientAccountId?: string;
}

export function ImmunizationsSection({ patientAccountId }: ImmunizationsSectionProps) {
  const [expanded, setExpanded] = useState(false);
  
  const { data: immunizations } = useQuery({
    queryKey: ["patient-immunizations", patientAccountId],
    queryFn: async () => {
      if (!patientAccountId) return [];
      const { data, error } = await supabase
        .from("patient_immunizations")
        .select("*")
        .eq("patient_account_id", patientAccountId)
        .order("date_administered", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!patientAccountId,
  });
  
  const visibleImmunizations = expanded 
    ? (immunizations || []) 
    : (immunizations || []).slice(0, 2);

  return (
    <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-purple-500/10 to-indigo-500/5 backdrop-blur-sm shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
      {/* Animated border glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <CardHeader className="relative z-10">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 shadow-lg">
              <Syringe className="h-6 w-6 text-white" />
            </div>
            <span className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent font-bold">
              Immunizations
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
        {immunizations && immunizations.length > 0 ? (
          <div className="space-y-3">
            {visibleImmunizations.map((immunization) => (
              <div key={immunization.id} className="flex items-start justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{immunization.vaccine_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(immunization.date_administered), 'MMM dd, yyyy')}
                  </p>
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
            {immunizations.length > 2 && (
              <div className="flex justify-end pt-2">
                <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
                  {expanded ? "Show less" : "Show more"}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            No immunizations recorded
          </p>
        )}
      </CardContent>
    </Card>
  );
}
