import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Syringe, Plus, Edit, Eye, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useState } from "react";
import { ImmunizationDialog } from "./dialogs/ImmunizationDialog";
import { toast } from "@/hooks/use-toast";
import { logMedicalVaultChange, mapRoleToAuditRole } from "@/hooks/useAuditLogs";
import { useAuth } from "@/contexts/AuthContext";
import { asImmunization, type VaultRecordBase } from "@/lib/vault";

interface ImmunizationsSectionProps {
  patientAccountId?: string;
}

const formatTimestamp = (dateString?: string | null) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return format(date, 'MMM dd, yyyy h:mm a');
  } catch {
    return '';
  }
};

export function ImmunizationsSection({ patientAccountId }: ImmunizationsSectionProps) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedImmunization, setSelectedImmunization] = useState<any>(null);
  const [dialogMode, setDialogMode] = useState<"add" | "edit" | "view">("add");
  const { effectiveUserId, effectiveRole } = useAuth();
  
  const { data: immunizations } = useQuery({
    queryKey: ["patient-immunizations", patientAccountId],
    queryFn: async () => {
      if (!patientAccountId) return [];
      const { data, error } = await supabase
        .from("patient_medical_vault")
        .select("*")
        .eq("patient_account_id", patientAccountId)
        .eq("record_type", "immunization")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((item) => ({
        id: item.id,
        ...asImmunization(item as VaultRecordBase),
        created_at: item.created_at
      }));
    },
    enabled: !!patientAccountId,
  });
  
  const visibleImmunizations = expanded 
    ? (immunizations || []) 
    : (immunizations || []).slice(0, 2);

  const handleDelete = async (immunization: any) => {
    if (!confirm(`Are you sure you want to remove this immunization record?`)) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Fetch practice_id from patient_accounts
      const { data: patientAccount } = await supabase
        .from("patient_accounts")
        .select("practice_id")
        .eq("id", patientAccountId)
        .single();

      if (!patientAccount) throw new Error("Patient account not found");

      // Soft delete: set active = false
      const { error } = await supabase
        .from("patient_medical_vault")
        .update({ active: false })
        .eq("id", immunization.id);

      if (error) throw error;

      queryClient.invalidateQueries({ 
        queryKey: ["patient-immunizations", patientAccountId] 
      });

      toast({
        title: "Success",
        description: "Immunization record removed successfully",
      });

      // Log the soft deletion with before/after values
      await logMedicalVaultChange({
        patientAccountId,
        actionType: 'soft_deleted',
        entityType: 'immunization',
        entityId: immunization.id,
        entityName: immunization.vaccine_name,
        changedByUserId: user.id,
        changedByRole: mapRoleToAuditRole(effectiveRole),
        oldData: { ...immunization, active: true },
        newData: { ...immunization, active: false },
        changeSummary: `Patient removed immunization: ${immunization.vaccine_name}`,
      });
    } catch (error) {
      console.error("Error removing immunization:", error);
      toast({
        title: "Error",
        description: "Failed to remove immunization",
        variant: "destructive",
      });
    }
  };

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
            onClick={() => {
              setSelectedImmunization(null);
              setDialogMode("add");
              setDialogOpen(true);
            }}
            variant="outline"
            className="shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        {immunizations && immunizations.length > 0 ? (
          <div className="space-y-3">
            {visibleImmunizations.map((immunization: any) => {
              const data = asImmunization({ ...immunization, record_type: 'immunization', record_data: immunization, patient_account_id: patientAccountId || '', created_at: immunization.created_at });
              return (
              <div key={immunization.id} className="flex items-start justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex flex-col gap-1">
                    <p className="font-medium">{data.vaccine}</p>
                    {data.date_administered && (
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(data.date_administered), 'MMM dd, yyyy')}
                      </p>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Recorded: {formatTimestamp(immunization.created_at)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => {
                      setSelectedImmunization(immunization);
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
                      setSelectedImmunization(immunization);
                      setDialogMode("edit");
                      setDialogOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => handleDelete(immunization)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
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

      <ImmunizationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        patientAccountId={patientAccountId || ""}
        immunization={selectedImmunization}
        mode={dialogMode}
      />
    </Card>
  );
}
