import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Plus, Edit, Eye, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useState } from "react";
import { ConditionDialog } from "./dialogs/ConditionDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { logMedicalVaultChange, mapRoleToAuditRole } from "@/hooks/useAuditLogs";
import { useAuth } from "@/contexts/AuthContext";

interface Condition {
  id: string;
  condition_name: string;
  description?: string;
  severity?: string;
  date_diagnosed?: string;
  is_active: boolean;
}

interface ConditionsSectionProps {
  patientAccountId?: string;
  conditions: Condition[];
}

export function ConditionsSection({ patientAccountId, conditions }: ConditionsSectionProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState<any>(null);
  const [dialogMode, setDialogMode] = useState<"add" | "edit" | "view">("add");
  const [expanded, setExpanded] = useState(false);
  const { effectiveUserId, effectiveRole } = useAuth();
  
  const visibleConditions = expanded ? conditions : conditions.slice(0, 2);

  const openDialog = (mode: "add" | "edit" | "view", condition?: any) => {
    setDialogMode(mode);
    setSelectedCondition(condition || null);
    setDialogOpen(true);
  };

  const handleDelete = async (condition: any) => {
    if (!confirm(`Are you sure you want to delete ${condition.condition_name}?`)) return;
    
    try {
      const { error } = await supabase
        .from("patient_conditions")
        .delete()
        .eq("id", condition.id);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ["patient-conditions", patientAccountId] });
      toast({ title: "Success", description: "Condition deleted successfully" });
      if (patientAccountId) {
        await logMedicalVaultChange({
          patientAccountId,
          actionType: 'deleted',
          entityType: 'condition',
          entityId: condition.id,
          entityName: condition.condition_name,
          changedByUserId: effectiveUserId || undefined,
          changedByRole: mapRoleToAuditRole(effectiveRole),
          oldData: condition,
          changeSummary: `Deleted condition: ${condition.condition_name}`,
        });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete condition", variant: "destructive" });
    }
  };

  const handleToggleActive = async (condition: any) => {
    const action = condition.is_active ? "mark as inactive" : "mark as active";
    if (!confirm(`Are you sure you want to ${action} ${condition.condition_name}?`)) return;
    
    try {
      const { error } = await supabase
        .from("patient_conditions")
        .update({ is_active: !condition.is_active })
        .eq("id", condition.id);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ["patient-conditions", patientAccountId] });
      toast({ 
        title: "Success", 
        description: `Condition ${condition.is_active ? "marked as inactive" : "marked as active"} successfully` 
      });
      if (patientAccountId) {
        await logMedicalVaultChange({
          patientAccountId,
          actionType: 'updated',
          entityType: 'condition',
          entityId: condition.id,
          entityName: condition.condition_name,
          changedByUserId: effectiveUserId || undefined,
          changedByRole: mapRoleToAuditRole(effectiveRole),
          oldData: { is_active: condition.is_active },
          newData: { is_active: !condition.is_active },
          changeSummary: `Set condition ${condition.condition_name} to ${condition.is_active ? 'inactive' : 'active'}`,
        });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update condition status", variant: "destructive" });
    }
  };
  
  return (
    <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-red-500/10 to-pink-500/5 backdrop-blur-sm shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
      <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <CardHeader className="relative z-10">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-red-500 to-pink-500 shadow-lg">
              <Heart className="h-6 w-6 text-white" />
            </div>
            <span className="bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent font-bold">
              Medical Conditions
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
        {conditions.length > 0 ? (
          <div className="space-y-3">
            {visibleConditions.map((condition) => (
              <div key={condition.id} className="flex items-start justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{condition.condition_name}</p>
                    <Badge 
                      variant={condition.is_active ? "success" : "outline"} 
                      className="text-xs"
                    >
                      {condition.is_active ? "Active" : "Inactive"}
                    </Badge>
                    {condition.severity && (
                      <Badge 
                        variant={
                          condition.severity === 'severe' ? 'destructive' : 
                          condition.severity === 'moderate' ? 'default' : 
                          'outline'
                        }
                        className="text-xs"
                      >
                        {condition.severity}
                      </Badge>
                    )}
                  </div>
                  {condition.description && (
                    <p className="text-sm text-muted-foreground">{condition.description}</p>
                  )}
                  {condition.date_diagnosed && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Diagnosed: {format(new Date(condition.date_diagnosed), 'MMM dd, yyyy')}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openDialog("view", condition)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openDialog("edit", condition)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => handleToggleActive(condition)} 
                    title={condition.is_active ? "Mark inactive" : "Mark active"}
                  >
                    {condition.is_active ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(condition)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {conditions.length > 2 && (
              <div className="flex justify-end pt-2">
                <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
                  {expanded ? "Show less" : "Show more"}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            No conditions recorded
          </p>
        )}
      </CardContent>

      {patientAccountId && (
        <ConditionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          patientAccountId={patientAccountId}
          condition={selectedCondition}
          mode={dialogMode}
        />
      )}
    </Card>
  );
}
