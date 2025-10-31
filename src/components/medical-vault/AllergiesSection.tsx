import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Plus, Edit, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { AllergyDialog } from "./dialogs/AllergyDialog";

interface Allergy {
  id: string;
  nka: boolean;
  allergen_name?: string;
  reaction_type?: string;
  severity?: string;
  is_active: boolean;
}

interface AllergiesSectionProps {
  patientAccountId?: string;
  allergies: Allergy[];
}

export function AllergiesSection({ patientAccountId, allergies }: AllergiesSectionProps) {
  const hasNKA = allergies.some(a => a.nka);
  const activeAllergies = allergies.filter(a => a.is_active && !a.nka);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAllergy, setSelectedAllergy] = useState<any>(null);
  const [dialogMode, setDialogMode] = useState<"add" | "edit" | "view">("add");

  const openDialog = (mode: "add" | "edit" | "view", allergy?: any) => {
    setDialogMode(mode);
    setSelectedAllergy(allergy || null);
    setDialogOpen(true);
  };
  
  return (
    <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-orange-500/10 to-amber-500/5 backdrop-blur-sm shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
      <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <CardHeader className="relative z-10">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg">
              <AlertCircle className="h-6 w-6 text-white" />
            </div>
            <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent font-bold">
              Allergies
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
        {hasNKA ? (
          <div className="flex items-center justify-center py-8">
            <Badge variant="outline" className="text-base px-4 py-2">
              NKA (No Known Allergies)
            </Badge>
          </div>
        ) : activeAllergies.length > 0 ? (
          <div className="space-y-3">
            {activeAllergies.map((allergy) => (
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
                </div>
              </div>
            ))}
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
