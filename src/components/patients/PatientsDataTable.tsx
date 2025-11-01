import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import type { Database } from "@/integrations/supabase/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Search, Edit, UserPlus, CheckCircle, Lock, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PatientDialog } from "./PatientDialog";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { formatPhoneNumber } from "@/lib/validators";
import { logger } from "@/lib/logger";

export const PatientsDataTable = () => {
  const { effectiveRole, effectivePracticeId, user } = useAuth();
  const { isSubscribed } = useSubscription();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: patients, isLoading, refetch } = useQuery<any[]>({
    queryKey: ["patients", effectiveRole, effectivePracticeId],
    staleTime: 300000, // 5 minutes - patient data changes infrequently
    queryFn: async () => {
      logger.info('Patients query params', logger.sanitize({ effectiveRole, effectivePracticeId }));
      const columns = "id, name, first_name, last_name, email, phone, address, address_street, address_city, address_state, address_zip, address_formatted, birth_date, date_of_birth, allergies, notes, address_verification_status, address_verification_source, practice_id, provider_id, created_at";

      let patientsData: any[] = [];

      if ((effectiveRole === "doctor" || effectiveRole === "provider") && effectivePracticeId) {
        // 1) Patients explicitly assigned to this practice
        const { data: byPractice, error: byPracticeErr } = await supabase
          .from("patient_accounts")
          .select(columns)
          .eq("practice_id", effectivePracticeId)
          .order("created_at", { ascending: false });

        if (byPracticeErr) {
          logger.error("Error fetching patients by practice", byPracticeErr);
          throw byPracticeErr;
        }
        patientsData = byPractice || [];

        // 2) Also include patients assigned to providers that belong to this practice (even if practice_id is NULL)
        const { data: providerRows } = await supabase
          .from("providers")
          .select("id")
          .eq("practice_id", effectivePracticeId);

        const providerIds = (providerRows || []).map(p => p.id);
        if (providerIds.length > 0) {
          const { data: byProvider, error: byProviderErr } = await supabase
            .from("patient_accounts")
            .select(columns)
            .in("provider_id", providerIds)
            .order("created_at", { ascending: false });

          if (byProviderErr) {
            logger.error("Error fetching patients by provider", byProviderErr);
            throw byProviderErr;
          }

          // Merge and de-duplicate
          const map = new Map<string, any>();
          for (const p of [...patientsData, ...(byProvider || [])]) {
            map.set(p.id, p);
          }
          patientsData = Array.from(map.values());
        }
      } else {
        // Admins (or roles without a practice context) get full list per RLS
        const { data, error } = await supabase
          .from("patient_accounts")
          .select(columns)
          .order("created_at", { ascending: false });
        if (error) {
          logger.error("Error fetching patients", error);
          throw error;
        }
        patientsData = data || [];
      }

      logger.info('Patients fetched', { count: patientsData?.length || 0 });

      // Fetch practice details for all patients
      if (patientsData && patientsData.length > 0) {
        const practiceIds = [...new Set(patientsData.map(p => p.practice_id).filter(Boolean))];
        
        if (practiceIds.length > 0) {
          const { data: practicesData } = await supabase
            .from("profiles")
            .select("id, name, email")
            .in("id", practiceIds);

          // Map practice data to patients
          const practicesMap = new Map(practicesData?.map(p => [p.id, p]) || []);
          return patientsData.map(patient => ({
            ...patient,
            practice: practicesMap.get(patient.practice_id)
          }));
        }
      }

      return patientsData || [];
    },
    enabled: effectiveRole === "admin" || effectiveRole === "doctor" || (effectiveRole === "provider" && !!effectivePracticeId),
  });

  const filteredPatients = useMemo(() => patients?.filter(patient =>
    patient.name?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [], [patients, searchQuery]);

  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    hasNextPage,
    hasPrevPage
  } = usePagination({
    totalItems: filteredPatients?.length || 0,
    itemsPerPage: 25
  });

  const paginatedPatients = filteredPatients?.slice(startIndex, endIndex);

  const handleAddPatient = useCallback(() => {
    setSelectedPatient(null);
    setDialogOpen(true);
  }, []);

  const handleEditPatient = useCallback((patient: any) => {
    setSelectedPatient(patient);
    setDialogOpen(true);
  }, []);

  const isAdmin = effectiveRole === "admin";

  // Fetch portal status for patients
  const { data: portalStatusMap } = useQuery({
    queryKey: ['patient-portal-status', effectivePracticeId],
    queryFn: async () => {
      if (!effectivePracticeId) return new Map();
      
      const { data } = await supabase
        .from('v_patients_with_portal_status')
        .select('patient_id, has_portal_access, portal_status')
        .eq('practice_id', effectivePracticeId);
      
      return new Map(data?.map(p => [p.patient_id, p]) || []);
    },
    enabled: !!effectivePracticeId && !isAdmin,
  });

  // Grant portal access mutation
  const invitePatientMutation = useMutation({
    mutationFn: async (patientId: string) => {
      if (!isSubscribed) {
        throw new Error('VitaLuxePro subscription required');
      }

      // Create portal account
      const { data: portalData, error: portalError } = await supabase.functions.invoke(
        'create-patient-portal-account',
        { body: { patientId } }
      );

      if (portalError) {
        console.error('[Patient Portal] Edge function invocation error:', portalError);
        throw portalError;
      }

      if (!portalData?.success) {
        console.error('[Patient Portal] Function returned error:', portalData);
        throw new Error(portalData?.error || 'Failed to create portal account');
      }

      // Fetch patient details for email
      const { data: patient } = await supabase
        .from('patient_accounts')
        .select('email, name, first_name, last_name, practice_id')
        .eq('id', patientId)
        .single();

      if (!patient?.email) {
        throw new Error('Patient email not found');
      }

      // Send welcome email (works for both new and re-invited patients)
      const { error: emailError } = await supabase.functions.invoke(
        'send-patient-welcome-email',
        {
          body: {
            userId: portalData.userId,
            email: patient.email.toLowerCase(),
            name: patient.name,
            token: portalData.token,
            practiceId: patient.practice_id,
          },
        }
      );

      if (emailError) {
        console.error('[Patient Portal] Email error:', emailError);
        throw emailError;
      }

      return { portalData, patient };
    },
    onSuccess: (data) => {
      const message = data.portalData.alreadyHadAccount 
        ? 'Portal invitation re-sent successfully'
        : 'Portal access granted and invitation email sent';
      toast({
        title: "Success",
        description: message,
      });
      queryClient.invalidateQueries({ queryKey: ['patient-portal-status'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
    onError: (error: any) => {
      console.error('[Patient Portal] Invite failed:', error);
      
      // Extract error details
      const errorMessage = error?.context?.error || 
                          error?.context?.body?.error || 
                          error?.message || 
                          "Failed to grant portal access";
      
      const errorCode = error?.context?.code || error?.context?.body?.code;
      const debugInfo = error?.context?.body?.debug;
      
      // Build description with debug info if available
      let description = errorMessage;
      if (debugInfo) {
        description += `\n\nDebug: ${JSON.stringify(debugInfo)}`;
      }
      
      // Special handling for specific error codes
      let title = "Error";
      if (errorCode === 'no_practice_context') {
        title = "Configuration Error";
      } else if (errorCode === 'unauthorized_role') {
        title = "Access Denied";
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
    },
  });

  const handleGrantPortalAccess = useCallback((patientId: string) => {
    if (!isSubscribed) {
      toast({
        title: "VitaLuxePro Required",
        description: "Upgrade to invite patients to the portal",
        variant: "destructive",
      });
      return;
    }
    invitePatientMutation.mutate(patientId);
  }, [isSubscribed, invitePatientMutation, toast]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search patients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {!isAdmin && (
          <Button onClick={handleAddPatient}>
            <Plus className="mr-2 h-4 w-4" />
            Add Patient
          </Button>
        )}
      </div>

      <div className="rounded-md border border-border bg-card overflow-x-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="min-w-[1000px]">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Address</TableHead>
              {isAdmin && <TableHead>Practice</TableHead>}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5} className="text-center">
                  Loading patients...
                </TableCell>
              </TableRow>
            ) : filteredPatients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-muted-foreground">
                  {searchQuery ? "No patients found matching your search." : "No patients found. Add your first patient to get started."}
                </TableCell>
              </TableRow>
            ) : (
              paginatedPatients?.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell className="font-medium">{patient.name}</TableCell>
                  <TableCell>{patient.email || "-"}</TableCell>
                  <TableCell>{formatPhoneNumber(patient.phone)}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {patient.address_formatted || 
                     (patient.address_street ? 
                       `${patient.address_street}${patient.address_city ? ', ' + patient.address_city : ''}${patient.address_state ? ', ' + patient.address_state : ''} ${patient.address_zip || ''}`.trim() 
                       : patient.address || "-")}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      {patient.practice?.name || "-"}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    {!isAdmin && (
                      <div className="flex items-center justify-end gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/patients/${patient.id}`)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View Patient File</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditPatient(patient)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        
                        <TooltipProvider>
                          {isSubscribed && !portalStatusMap?.get(patient.id)?.has_portal_access ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleGrantPortalAccess(patient.id)}
                                  disabled={invitePatientMutation.isPending}
                                >
                                  <UserPlus className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Grant Portal Access</TooltipContent>
                            </Tooltip>
                          ) : portalStatusMap?.get(patient.id)?.has_portal_access ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center justify-center w-9 h-9">
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>Portal Access Granted</TooltipContent>
                            </Tooltip>
                          ) : !isSubscribed ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center justify-center w-9 h-9">
                                  <Lock className="h-4 w-4 text-muted-foreground" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>VitaLuxePro Required</TooltipContent>
                            </Tooltip>
                          ) : null}
                        </TooltipProvider>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      {filteredPatients && filteredPatients.length > 0 && (
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          totalItems={filteredPatients.length}
          startIndex={startIndex}
          endIndex={Math.min(endIndex, filteredPatients.length)}
        />
      )}

      <PatientDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSelectedPatient(null);
          }
        }}
        patient={selectedPatient}
        onSuccess={() => {
          refetch();
          setSelectedPatient(null);
          setDialogOpen(false);
        }}
      />
    </div>
  );
};
