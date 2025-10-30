import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Plus, Edit, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

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
  const activeConditions = conditions.filter(c => c.is_active);
  
  return (
    <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-red-500/10 to-pink-500/5 backdrop-blur-sm shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
      {/* Animated border glow effect */}
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
            className="bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all duration-300"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        {activeConditions.length > 0 ? (
          <div className="space-y-3">
            {activeConditions.map((condition) => (
              <div key={condition.id} className="flex items-start justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{condition.condition_name}</p>
                    <Badge variant="secondary" className="text-xs">Active</Badge>
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
            No conditions recorded
          </p>
        )}
      </CardContent>
    </Card>
  );
}
