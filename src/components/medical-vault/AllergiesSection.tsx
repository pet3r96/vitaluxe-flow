import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Plus, Edit, Eye, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { AllergyDialog } from "./dialogs/AllergyDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface Allergy {
  id: string;
  nka: boolean;
  allergen_name?: string;
  reaction_type?: string;
  severity?: string;
  is_active: boolean;
  notes?: string;
}

interface AllergiesSectionProps {
  patientAccountId?: string;
  allergies: Allergy[];
}

export function AllergiesSection({ patientAccountId, allergies }: AllergiesSectionProps) {
  const queryClient = useQueryClient();
  const nkaRecord = allergies.find(a => a.is_active && a.nka);
  const activeAllergies = allergies.filter(a => a.is_active && !a.nka);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAllergy, setSelectedAllergy] = useState<any>(null);
  const [dialogMode, setDialogMode] = useState<"add" | "edit" | "view">("add");
  const [expanded, setExpanded] = useState(false);
  
  const visibleAllergies = expanded ? activeAllergies : activeAllergies.slice(0, 2);

  const openDialog = (mode: "add" | "edit" | "view", allergy?: any) => {
    setDialogMode(mode);
    setSelectedAllergy(allergy || null);
    setDialogOpen(true);
  };

  const handleDelete = async (allergy: any) => {
    if (!confirm(`Are you sure you want to delete ${allergy.nka ? 'NKA record' : allergy.allergen_name}?`)) return;
    
    try {
      const { error } = await supabase
        .from("patient_allergies")
        .delete()
        .eq("id", allergy.id);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ["patient-allergies", patientAccountId] });
      toast({ title: "Success", description: "Allergy deleted successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete allergy", variant: "destructive" });
    }
  };
  
  return (
    <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-gold1/10 to-gold2/5 backdrop-blur-sm shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
      <div className="absolute inset-0 bg-gradient-to-r from-gold1/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <CardHeader className="relative z-10">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gold-gradient shadow-lg">
              <AlertCircle className="h-6 w-6 text-white" />
            </div>
            <span className="bg-gradient-to-r from-gold1 to-gold2 bg-clip-text text-transparent font-bold">
              Allergies
            </span>
          </CardTitle>
          <Button 
            size="sm" 
            variant="outline"
            className="shadow-sm"
            onClick={() => openDialog("add")}
            disabled={!patientAccountId || !!nkaRecord}
            title={nkaRecord ? "Remove NKA first to add specific allergies" : ""}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        {nkaRecord ? (
          <div className="flex items-center justify-between p-4 border rounded-lg border-green-500/20 bg-green-500/5">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-base px-4 py-2 border-green-500/50">
                NKA (No Known Allergies)
              </Badge>
              {nkaRecord.notes && (
                <span className="text-sm text-muted-foreground">• {nkaRecord.notes}</span>
              )}
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => openDialog("view", nkaRecord)}>
                <Eye className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => openDialog("edit", nkaRecord)}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleDelete(nkaRecord)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : activeAllergies.length > 0 ? (
          <div className="space-y-3">
            {visibleAllergies.map((allergy) => (
              <div key={allergy.id} className="flex items-start justify-between p-3 border rounded-lg border-destructive/20 bg-destructive/5">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{allergy.allergen_name}</p>
                    <Badge 
                      variant={
                        allergy.severity === 'severe' ? 'destructive' : 
                        allergy.severity === 'moderate' ? 'default' : 
                        'outline'
                      }
                      className="text-xs"
                    >
                      {allergy.severity || 'Unknown'}
                    </Badge>
                  </div>
                  {allergy.reaction_type && (
                    <p className="text-sm text-muted-foreground">
                      Reaction: {allergy.reaction_type}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openDialog("view", allergy)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openDialog("edit", allergy)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(allergy)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {activeAllergies.length > 2 && (
              <div className="flex justify-end pt-2">
                <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
                  {expanded ? "Show less" : "Show more"}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            No allergies recorded
          </p>
        )}
      </CardContent>

      {patientAccountId && (
        <AllergyDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          patientAccountId={patientAccountId}
          allergy={selectedAllergy}
          mode={dialogMode}
        />
      )}
    </Card>
  );
}
