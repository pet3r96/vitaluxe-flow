import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Pill, Heart, AlertCircle, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

interface MedicalVaultSummaryCardProps {
  patientAccountId: string;
}

export function MedicalVaultSummaryCard({ patientAccountId }: MedicalVaultSummaryCardProps) {
  const navigate = useNavigate();

  const { data: counts, isLoading } = useQuery({
    queryKey: ['medical-vault-counts', patientAccountId],
    queryFn: async () => {
      const [medications, conditions, allergies, vitals] = await Promise.all([
        supabase
          .from('patient_medications')
          .select('id', { count: 'exact', head: true })
          .eq('patient_account_id', patientAccountId)
          .eq('is_active', true),
        supabase
          .from('patient_conditions')
          .select('id', { count: 'exact', head: true })
          .eq('patient_account_id', patientAccountId)
          .eq('is_active', true),
        supabase
          .from('patient_allergies')
          .select('id, nka', { count: 'exact' })
          .eq('patient_account_id', patientAccountId)
          .eq('is_active', true),
        supabase
          .from('patient_vitals')
          .select('*')
          .eq('patient_account_id', patientAccountId)
          .order('date_recorded', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      
      const hasNKA = allergies.data?.some(a => a.nka) || false;
      const allergyCount = hasNKA ? 0 : (allergies.count || 0);

      return {
        medications: medications.count || 0,
        conditions: conditions.count || 0,
        allergies: allergyCount,
        hasNKA,
        lastVital: vitals.data,
      };
    },
    enabled: !!patientAccountId,
  });

  const handleViewVault = () => {
    navigate(`/practice/patients/${patientAccountId}/medical-vault`);
  };

  if (isLoading) {
    return (
      <Card className="hover:shadow-lg transition-all">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Medical Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      variant="modern"
      className="group cursor-pointer hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-primary overflow-hidden" 
      onClick={handleViewVault}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <CardHeader className="relative z-10 bg-gradient-to-r from-primary/5 to-transparent">
        <CardTitle className="text-lg flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          Medical Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-lg bg-accent/5 hover:bg-primary/10 transition-colors">
            <div className="flex items-center justify-center mb-2">
              <div className="p-2 rounded-full bg-secondary/10">
                <Pill className="h-5 w-5 text-secondary" />
              </div>
            </div>
            <p className="text-3xl font-bold text-primary mb-1">{counts?.medications || 0}</p>
            <p className="text-xs font-medium text-muted-foreground">Medications</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-accent/5 hover:bg-primary/10 transition-colors">
            <div className="flex items-center justify-center mb-2">
              <div className="p-2 rounded-full bg-primary/10">
                <Heart className="h-5 w-5 text-primary" />
              </div>
            </div>
            <p className="text-3xl font-bold text-primary mb-1">{counts?.conditions || 0}</p>
            <p className="text-xs font-medium text-muted-foreground">Conditions</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-accent/5 hover:bg-destructive/10 transition-colors">
            <div className="flex items-center justify-center mb-2">
              <div className="p-2 rounded-full bg-destructive/10">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
            </div>
            {counts?.hasNKA ? (
              <>
                <Badge variant="secondary" className="text-xs mb-1 font-semibold">NKA</Badge>
                <p className="text-xs text-muted-foreground">No Known Allergies</p>
              </>
            ) : (
              <>
                <p className="text-3xl font-bold text-primary mb-1">{counts?.allergies || 0}</p>
                <p className="text-xs font-medium text-muted-foreground">Allergies</p>
              </>
            )}
          </div>
          <div className="text-center p-3 rounded-lg bg-accent/5 hover:bg-success/10 transition-colors">
            <div className="flex items-center justify-center mb-2">
              <div className="p-2 rounded-full bg-success/10">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
            </div>
            {counts?.lastVital ? (
              <>
                <p className="text-lg font-bold mb-1">
                  {counts.lastVital.blood_pressure_systolic}/{counts.lastVital.blood_pressure_diastolic}
                </p>
                <p className="text-xs font-medium text-muted-foreground">Last BP</p>
              </>
            ) : (
              <>
                <p className="text-xl font-bold text-muted-foreground mb-1">--</p>
                <p className="text-xs text-muted-foreground">No vitals</p>
              </>
            )}
          </div>
        </div>
        <Button 
          variant="default" 
          size="sm" 
          className="w-full group-hover:shadow-lg transition-shadow"
        >
          View Full Medical Vault 
          <Activity className="ml-2 h-4 w-4 group-hover:rotate-90 transition-transform" />
        </Button>
      </CardContent>
    </Card>
  );
}
