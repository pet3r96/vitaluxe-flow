import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Scissors, Plus, Edit, Eye, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useState } from "react";
import { SurgeryDialog } from "./dialogs/SurgeryDialog";
import { toast } from "@/hooks/use-toast";
import { logMedicalVaultChange } from "@/hooks/useAuditLogs";
import { useAuth } from "@/contexts/AuthContext";

interface SurgeriesSectionProps {
  patientAccountId?: string;
}

export function SurgeriesSection({ patientAccountId }: SurgeriesSectionProps) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSurgery, setSelectedSurgery] = useState<any>(null);
  const [dialogMode, setDialogMode] = useState<"add" | "edit" | "view">("add");
  const { effectiveUserId, effectiveRole } = useAuth();
  
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
  
  const visibleSurgeries = expanded 
    ? (surgeries || []) 
    : (surgeries || []).slice(0, 2);

  const handleDelete = async (surgery: any) => {
    if (!confirm(`Are you sure you want to delete ${surgery.surgery_type}?`)) return;
    
    try {
      const { error } = await supabase
        .from("patient_surgeries")
        .delete()
        .eq("id", surgery.id);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ["patient-surgeries", patientAccountId] });
      toast({ title: "Success", description: "Surgery deleted successfully" });
      if (patientAccountId) {
        await logMedicalVaultChange({
          patientAccountId,
          actionType: 'deleted',
          entityType: 'surgery',
          entityId: surgery.id,
          entityName: surgery.surgery_type,
          changedByUserId: effectiveUserId || undefined,
          changedByRole: effectiveRole === 'patient' ? 'patient' : (effectiveRole === 'staff' ? 'staff' : 'doctor'),
          oldData: surgery,
          changeSummary: `Deleted surgery: ${surgery.surgery_type}`,
        });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete surgery", variant: "destructive" });
    }
  };

  return (
    <Card className="group relative overflow-visible border-0 bg-gradient-to-br from-teal-500/10 to-cyan-500/5 backdrop-blur-sm shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
      {/* Animated border glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-teal-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <CardHeader className="relative z-10 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-2 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 shadow-lg flex-shrink-0">
              <Scissors className="h-6 w-6 text-white" />
            </div>
            <CardTitle className="text-xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent break-words">
              Surgeries
            </CardTitle>
          </div>
          <Button 
            size="sm" 
            onClick={() => {
              setSelectedSurgery(null);
              setDialogMode("add");
              setDialogOpen(true);
            }}
            variant="outline"
            className="shadow-sm flex-shrink-0"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        {surgeries && surgeries.length > 0 ? (
          <div className="space-y-3">
            {visibleSurgeries.map((surgery) => (
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
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => {
                      setSelectedSurgery(surgery);
                      setDialogMode("view");
                      setDialogOpen(true);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => {
                      setSelectedSurgery(surgery);
                      setDialogMode("edit");
                      setDialogOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => handleDelete(surgery)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {surgeries.length > 2 && (
              <div className="flex justify-end pt-2">
                <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
                  {expanded ? "Show less" : "Show more"}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            No surgeries recorded
          </p>
        )}
      </CardContent>

      <SurgeryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        patientAccountId={patientAccountId || ""}
        surgery={selectedSurgery}
        mode={dialogMode}
      />
    </Card>
  );
}
