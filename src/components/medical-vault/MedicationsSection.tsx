import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill, Plus, Edit, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Medication {
  id: string;
  medication_name: string;
  dosage?: string;
  frequency?: string;
  start_date?: string;
  stop_date?: string;
  is_active: boolean;
  notes?: string;
}

interface MedicationsSectionProps {
  patientAccountId?: string;
  medications: Medication[];
}

export function MedicationsSection({ patientAccountId, medications }: MedicationsSectionProps) {
  const activeMedications = medications.filter(m => m.is_active);
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5" />
            Medications
          </CardTitle>
          <Button size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {activeMedications.length > 0 ? (
          <div className="space-y-3">
            {activeMedications.map((med) => (
              <div key={med.id} className="flex items-start justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{med.medication_name}</p>
                    <Badge variant="secondary" className="text-xs">Active</Badge>
                  </div>
                  {med.dosage && (
                    <p className="text-sm text-muted-foreground">
                      {med.dosage} {med.frequency && `• ${med.frequency}`}
                    </p>
                  )}
                  {med.start_date && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Started: {format(new Date(med.start_date), 'MMM dd, yyyy')}
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
            No medications recorded
          </p>
        )}
      </CardContent>
    </Card>
  );
}
