import { useState } from "react";
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
import { Plus, Search, Edit, UserPlus, CheckCircle, Lock } from "lucide-react";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: patients, isLoading, refetch } = useQuery<any[]>({
    queryKey: ["patients", effectiveRole, effectivePracticeId],
    staleTime: 300000, // 5 minutes - patient data changes infrequently
    queryFn: async () => {
      logger.info('Patients query params', logger.sanitize({ effectiveRole, effectivePracticeId }));
      let patientsQuery = supabase
        .from("patients")
        .select("*")
        .order("created_at", { ascending: false });

      // If user is a practice (doctor) or provider, only show their practice's patients
      if ((effectiveRole === "doctor" || effectiveRole === "provider") && effectivePracticeId) {
        patientsQuery = patientsQuery.eq("practice_id", effectivePracticeId);
      }

      const { data: patientsData, error: patientsError } = await patientsQuery;
      if (patientsError) {
        logger.error("Error fetching patients", patientsError);
        throw patientsError;
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

  const filteredPatients = patients?.filter(patient =>
    patient.name?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

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

  const handleAddPatient = () => {
    setSelectedPatient(null);
    setDialogOpen(true);
  };

  const handleEditPatient = (patient: any) => {
    setSelectedPatient(patient);
    setDialogOpen(true);
  };

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

      if (portalError) throw portalError;

      // Fetch patient details for email
      const { data: patient } = await supabase
        .from('patients')
        .select('email, name')
        .eq('id', patientId)
        .single();

      if (!patient?.email) {
        throw new Error('Patient email not found');
      }

      // Send welcome email
      const { error: emailError } = await supabase.functions.invoke(
        'send-patient-welcome-email',
        {
          body: {
            email: patient.email,
            patientName: patient.name,
            tempPassword: portalData.tempPassword,
          },
        }
      );

      if (emailError) throw emailError;

      return { patientId };
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Portal access granted and invitation email sent",
      });
      queryClient.invalidateQueries({ queryKey: ['patient-portal-status'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to grant portal access",
        variant: "destructive",
      });
    },
  });

  const handleGrantPortalAccess = (patientId: string) => {
    if (!isSubscribed) {
      toast({
        title: "VitaLuxePro Required",
        description: "Upgrade to invite patients to the portal",
        variant: "destructive",
      });
      return;
    }
    invitePatientMutation.mutate(patientId);
  };

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
