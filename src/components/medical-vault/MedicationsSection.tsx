import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill, Plus, Edit, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useState } from "react";
import { MedicationDialog } from "./dialogs/MedicationDialog";

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState<any>(null);
  const [dialogMode, setDialogMode] = useState<"add" | "edit" | "view">("add");
  const [expanded, setExpanded] = useState(false);
  
  const visibleMedications = expanded ? activeMedications : activeMedications.slice(0, 3);

  const openDialog = (mode: "add" | "edit" | "view", medication?: any) => {
    setDialogMode(mode);
    setSelectedMedication(medication || null);
    setDialogOpen(true);
  };
  
  return (
    <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/5 backdrop-blur-sm shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
      {/* Animated border glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <CardHeader className="relative z-10">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg">
              <Pill className="h-6 w-6 text-white" />
            </div>
            <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent font-bold">
              Medications
            </span>
          </CardTitle>
          <Button 
            size="sm" 
            className="bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all duration-300"
            onClick={() => openDialog("add")}
            disabled={!patientAccountId}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        {activeMedications.length > 0 ? (
          <div className="space-y-3">
            {visibleMedications.map((med) => (
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
                  <Button size="sm" variant="ghost" onClick={() => openDialog("view", med)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openDialog("edit", med)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {activeMedications.length > 3 && (
              <div className="flex justify-end pt-2">
                <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
                  {expanded ? "Show less" : "Show more"}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            No medications recorded
          </p>
        )}
      </CardContent>

      {patientAccountId && (
        <MedicationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          patientAccountId={patientAccountId}
          medication={selectedMedication}
          mode={dialogMode}
        />
      )}
    </Card>
  );
}
