import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Syringe, Plus, Edit, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface ImmunizationsSectionProps {
  patientAccountId?: string;
}

export function ImmunizationsSection({ patientAccountId }: ImmunizationsSectionProps) {
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Syringe className="h-5 w-5" />
            Immunizations
          </CardTitle>
          <Button size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {immunizations && immunizations.length > 0 ? (
          <div className="space-y-3">
            {immunizations.map((immunization) => (
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
