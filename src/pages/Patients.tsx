import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PatientsDataTable } from "@/components/patients/PatientsDataTable";
import { Users, Lock, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { SubscriptionGuard } from "@/components/subscription/SubscriptionGuard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Mail, Send } from "lucide-react";
import { PatientPortalStatusBadge } from "@/components/patients/PatientPortalStatusBadge";
import { PatientInvitationDialog } from "@/components/patients/PatientInvitationDialog";
import { toast } from "sonner";

const Patients = () => {
  const { user, effectiveRole } = useAuth();
  const { isSubscribed } = useSubscription();
  const [search, setSearch] = useState("");
  const [bulkInviteDialogOpen, setBulkInviteDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch patients with portal status
  const { data: patientsWithStatus = [], isLoading } = useQuery({
    queryKey: ['patients-with-portal-status', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('v_patients_with_portal_status')
        .select('*')
        .eq('practice_id', user.id)
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user && (effectiveRole === 'doctor' || effectiveRole === 'provider'),
  });

  // Filter patients
  const filteredPatients = patientsWithStatus.filter(patient =>
    patient.name.toLowerCase().includes(search.toLowerCase())
  );

  // Get patients without portal access
  const patientsWithoutPortal = filteredPatients.filter(p => !p.has_portal_access);

  // Invite individual patient mutation
  const invitePatientMutation = useMutation({
    mutationFn: async (patientId: string) => {
      if (!isSubscribed) {
        throw new Error('VitaLuxePro subscription required to invite patients');
      }

      // Create portal account
      const { data: accountData, error: accountError } = await supabase.functions.invoke(
        'create-patient-portal-account',
        { body: { patientId } }
      );

      if (accountError) throw accountError;

      // Get patient details
      const { data: patient } = await supabase
        .from('patients')
        .select('name, email, practice_id')
        .eq('id', patientId)
        .single();

      if (!patient) throw new Error('Patient not found');

      // Send welcome email
      const { data: emailData, error: emailError } = await supabase.functions.invoke(
        'send-patient-welcome-email',
        {
          body: {
            userId: accountData.userId,
            email: patient.email,
            name: patient.name,
            token: accountData.token,
            practiceId: patient.practice_id,
          },
        }
      );

      if (emailError) throw emailError;

      return { accountData, emailData };
    },
    onSuccess: () => {
      toast.success('Welcome email sent successfully');
      queryClient.invalidateQueries({ queryKey: ['patients-with-portal-status'] });
    },
    onError: (error: any) => {
      toast.error('Failed to invite patient', {
        description: error.message,
      });
    },
  });

  const handleInviteClick = (patientId: string) => {
    if (!isSubscribed) {
      toast.error('VitaLuxePro subscription required', {
        description: 'Upgrade to invite patients to the portal'
      });
      return;
    }
    invitePatientMutation.mutate(patientId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">Patients</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage your patient information and records
        </p>
      </div>

      <Tabs defaultValue="records" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="records" className="gap-2">
            <Users className="w-4 h-4" />
            Patient Records
          </TabsTrigger>
          <TabsTrigger value="portal" className="gap-2">
            {isSubscribed ? (
              <UserPlus className="w-4 h-4" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            Portal Access
          </TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="mt-6">
          <PatientsDataTable />
        </TabsContent>

        <TabsContent value="portal" className="mt-6">
          <SubscriptionGuard
            feature="Patient Portal Management"
            upgradeMessage="Invite patients to the secure portal with VitaLuxePro"
          >
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search patients..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {patientsWithoutPortal.length > 0 && (
                  <Button
                    onClick={() => setBulkInviteDialogOpen(true)}
                    className="gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    Invite All ({patientsWithoutPortal.length})
                  </Button>
                )}
              </div>

              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading patients...</div>
              ) : filteredPatients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {search ? 'No patients found matching your search' : 'No patients yet'}
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredPatients.map(patient => (
                    <Card key={patient.patient_id} className="p-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-lg">{patient.name}</h3>
                            <PatientPortalStatusBadge
                              hasPortalAccount={patient.has_portal_access}
                              status={patient.portal_status as 'active' | 'invited' | null}
                              lastLoginAt={patient.last_login_at}
                            />
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="w-4 h-4" />
                            {patient.email}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {!patient.has_portal_access ? (
                            <Button
                              size="sm"
                              onClick={() => handleInviteClick(patient.patient_id)}
                              disabled={invitePatientMutation.isPending}
                              className="gap-2"
                            >
                              <Send className="w-3 h-3" />
                              Invite to Portal
                            </Button>
                          ) : patient.portal_status === 'invited' && !patient.last_login_at ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleInviteClick(patient.patient_id)}
                              disabled={invitePatientMutation.isPending}
                              className="gap-2"
                            >
                              <Mail className="w-3 h-3" />
                              Resend Email
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              <PatientInvitationDialog
                open={bulkInviteDialogOpen}
                onOpenChange={setBulkInviteDialogOpen}
                patientIds={patientsWithoutPortal.map(p => p.patient_id)}
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ['patients-with-portal-status'] });
                }}
              />
            </div>
          </SubscriptionGuard>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Patients;
