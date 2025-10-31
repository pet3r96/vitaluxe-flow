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
    <Card className="hover:shadow-lg transition-all cursor-pointer border-primary/20" onClick={handleViewVault}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Medical Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Pill className="h-4 w-4 text-primary mr-1" />
            </div>
            <p className="text-3xl font-bold text-primary">{counts?.medications || 0}</p>
            <p className="text-sm text-muted-foreground">Medications</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Heart className="h-4 w-4 text-primary mr-1" />
            </div>
            <p className="text-3xl font-bold text-primary">{counts?.conditions || 0}</p>
            <p className="text-sm text-muted-foreground">Conditions</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <AlertCircle className="h-4 w-4 text-primary mr-1" />
            </div>
            {counts?.hasNKA ? (
              <>
                <Badge variant="secondary" className="text-xs">NKA</Badge>
                <p className="text-xs text-muted-foreground mt-1">No Known Allergies</p>
              </>
            ) : (
              <>
                <p className="text-3xl font-bold text-primary">{counts?.allergies || 0}</p>
                <p className="text-sm text-muted-foreground">Allergies</p>
              </>
            )}
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <TrendingUp className="h-4 w-4 text-primary mr-1" />
            </div>
            {counts?.lastVital ? (
              <>
                <p className="text-lg font-semibold">
                  {counts.lastVital.blood_pressure_systolic}/{counts.lastVital.blood_pressure_diastolic}
                </p>
                <p className="text-xs text-muted-foreground">Last BP</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No vitals</p>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" className="w-full">
          View Full Medical Vault →
        </Button>
      </CardContent>
    </Card>
  );
}
