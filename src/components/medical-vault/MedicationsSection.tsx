import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill, Plus, Edit, Eye, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useState } from "react";
import { MedicationDialog } from "./dialogs/MedicationDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { logMedicalVaultChange, mapRoleToAuditRole } from "@/hooks/useAuditLogs";
import { useAuth } from "@/contexts/AuthContext";

const formatTimestamp = (dateString: string) => {
  return format(new Date(dateString), 'MMM dd, yyyy h:mm a');
};

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
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState<any>(null);
  const [dialogMode, setDialogMode] = useState<"add" | "edit" | "view">("add");
  const [expanded, setExpanded] = useState(false);
  const { effectiveUserId, effectiveRole } = useAuth();
  
  const visibleMedications = expanded ? medications : medications.slice(0, 2);

  const openDialog = (mode: "add" | "edit" | "view", medication?: any) => {
    setDialogMode(mode);
    setSelectedMedication(medication || null);
    setDialogOpen(true);
  };

  const handleDelete = async (medication: any) => {
    if (!confirm(`Are you sure you want to delete ${medication.medication_name}?`)) return;
    
    try {
      const { error } = await supabase
        .from("patient_medications")
        .delete()
        .eq("id", medication.id);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ["patient-medications", patientAccountId] });
      toast({ title: "Success", description: "Medication deleted successfully" });
      if (patientAccountId) {
        await logMedicalVaultChange({
          patientAccountId,
          actionType: 'deleted',
          entityType: 'medication',
          entityId: medication.id,
          entityName: medication.medication_name,
          changedByUserId: effectiveUserId || undefined,
          changedByRole: mapRoleToAuditRole(effectiveRole),
          oldData: medication,
          changeSummary: `Deleted medication: ${medication.medication_name}`,
        });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete medication", variant: "destructive" });
    }
  };

  const handleToggleActive = async (medication: any) => {
    const action = medication.is_active ? "mark as inactive" : "mark as active";
    if (!confirm(`Are you sure you want to ${action} ${medication.medication_name}?`)) return;
    
    try {
      const { error } = await supabase
        .from("patient_medications")
        .update({ is_active: !medication.is_active, updated_at: new Date().toISOString() })
        .eq("id", medication.id);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ["patient-medications", patientAccountId] });
      toast({ 
        title: "Success", 
        description: `Medication ${medication.is_active ? "marked as inactive" : "marked as active"} successfully` 
      });
      if (patientAccountId) {
        await logMedicalVaultChange({
          patientAccountId,
          actionType: 'updated',
          entityType: 'medication',
          entityId: medication.id,
          entityName: medication.medication_name,
          changedByUserId: effectiveUserId || undefined,
          changedByRole: mapRoleToAuditRole(effectiveRole),
          oldData: { is_active: medication.is_active },
          newData: { is_active: !medication.is_active },
          changeSummary: `Set medication ${medication.medication_name} to ${medication.is_active ? 'inactive' : 'active'}`,
        });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update medication status", variant: "destructive" });
    }
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
            variant="outline"
            className="shadow-sm"
            onClick={() => openDialog("add")}
            disabled={!patientAccountId}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        {medications.length > 0 ? (
          <div className="space-y-3">
            {visibleMedications.map((med) => (
              <div key={med.id} className="flex items-start justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{med.medication_name}</p>
                    <Badge 
                      variant={med.is_active ? "success" : "outline"} 
                      className="text-xs"
                    >
                      {med.is_active ? "Active" : "Inactive"}
                    </Badge>
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
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => handleToggleActive(med)} 
                      title={med.is_active ? "Mark inactive" : "Mark active"}
                    >
                      {med.is_active ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(med)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
              </div>
            ))}
            {medications.length > 2 && (
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
