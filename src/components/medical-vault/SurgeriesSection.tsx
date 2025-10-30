import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Scissors, Plus, Edit, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface SurgeriesSectionProps {
  patientAccountId?: string;
}

export function SurgeriesSection({ patientAccountId }: SurgeriesSectionProps) {
  const { data: surgeries } = useQuery({
    queryKey: ["patient-surgeries", patientAccountId],
    queryFn: async () => {
      if (!patientAccountId) return [];
      const { data, error } = await supabase
        .from("patient_surgeries")
        .select("*")
        .eq("patient_account_id", patientAccountId)
        .order("surgery_date", { ascending: false });
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
            <Scissors className="h-5 w-5" />
            Surgeries
          </CardTitle>
          <Button size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {surgeries && surgeries.length > 0 ? (
          <div className="space-y-3">
            {surgeries.map((surgery) => (
              <div key={surgery.id} className="flex items-start justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{surgery.surgery_type}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(surgery.surgery_date), 'MMM dd, yyyy')}
                  </p>
                  {surgery.surgeon_name && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Surgeon: {surgery.surgeon_name}
                    </p>
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
            No surgeries recorded
          </p>
        )}
      </CardContent>
    </Card>
  );
}
