import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Plus, Edit, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Allergies
          </CardTitle>
          <Button size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent>
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
            No allergies recorded
          </p>
        )}
      </CardContent>
    </Card>
  );
}
