import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { usePatients } from "@/hooks/usePatients";
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
import { Plus, Search, Edit, UserPlus, CheckCircle, Lock, Eye, Trash2, Ban } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PatientPortalStatusBadge } from "./PatientPortalStatusBadge";
import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PatientDialog } from "./PatientDialog";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { formatPhoneNumber } from "@/lib/validators";
import { logger } from "@/lib/logger";
import { formatPatientEmail } from "@/lib/email/emailValidation";

export const PatientsDataTable = () => {
  const { effectiveRole, effectivePracticeId, user } = useAuth();
  const { isSubscribed } = useSubscription();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [patientToToggle, setPatientToToggle] = useState<any>(null);

  // Use service layer hook for fetching patients
  const { data: patients, isLoading, refetch } = usePatients();

  const filteredPatients = useMemo(() => patients?.filter(patient => {
    const displayName = patient.name || 
      (patient.first_name && patient.last_name 
        ? `${patient.first_name} ${patient.last_name}`.trim() 
        : patient.first_name || patient.last_name || patient.email?.split('@')[0] || 'Unknown');
    return displayName.toLowerCase().includes(searchQuery.toLowerCase());
  }) || [], [patients, searchQuery]);

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
      const { data: patient, error: patientError } = await supabase
        .from('patient_accounts')
        .select('id, email, name, first_name, last_name, practice_id')
        .eq('id', patientId)
        .maybeSingle();

      if (patientError) {
        logger.error("Failed to fetch patient for portal invite", patientError, { patientId });
        throw new Error('Failed to load patient data');
      }

      if (!patient) {
        logger.warn("Patient not found for portal invite", { patientId });
        throw new Error('Patient not found or you do not have access');
      }

      if (!patient?.email) {
        throw new Error('Patient email not found');
      }

      // Try to send welcome email (works for both new and re-invited patients)
      const { error: emailError } = await supabase.functions.invoke(
        'send-welcome-email',
        {
          body: {
            userId: portalData.userId,
            email: patient.email.toLowerCase(),
            name: patient.name,
            role: 'patient',
            practiceId: patient.practice_id,
          },
        }
      );

      // Don't fail the entire operation if email fails
      if (emailError) {
        console.warn('[Patient Portal] Email sending failed:', emailError);
        return { 
          portalData, 
          patient,
          emailError,
          activationLink: `https://app.vitaluxeservices.com/change-password?token=${portalData.token}`
        };
      }

      return { portalData, patient };
    },
    onSuccess: async (data) => {
      if (data.emailError) {
        // Account created but email failed
        toast({
          title: "Portal Account Created",
          description: `Email could not be sent. Share this link manually:\n${data.activationLink}`,
        });
      } else {
        // Full success
        const message = data.portalData.alreadyHadAccount 
          ? 'Portal invitation re-sent successfully'
          : 'Portal access granted and invitation email sent';
        toast({
          title: "Success",
          description: message,
        });
      }

      // Log the portal access grant in audit logs
      if (data.patient && effectivePracticeId) {
        try {
          await supabase.from('audit_logs').insert({
            action_type: 'portal_access_granted',
            entity_type: 'patient_portal_account',
            entity_id: data.portalData.userId,
            user_id: user?.id,
            practice_id: effectivePracticeId,
            metadata: {
              patient_id: data.patient.id,
              patient_email: data.patient.email,
              patient_name: data.patient.name,
              re_invited: data.portalData.alreadyHadAccount || false
            }
          });
        } catch (auditError) {
          console.error('[Patient Portal] Audit log failed:', auditError);
          // Don't fail the operation if audit logging fails
        }
      }

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

  // Toggle patient account status mutation
  const togglePatientStatusMutation = useMutation({
    mutationFn: async ({ patientId, currentStatus }: { patientId: string; currentStatus: string }) => {
      const newStatus = currentStatus === 'disabled' ? 'active' : 'disabled';
      
      const { data, error } = await supabase
        .from('patient_accounts')
        .update({ status: newStatus })
        .eq('id', patientId)
        .select()
        .single();
      
      if (error) throw error;
      return { data, newStatus };
    },
    onSuccess: (result, variables) => {
      const action = result.newStatus === 'disabled' ? 'disabled' : 'enabled';
      toast({
        title: `Account ${action}`,
        description: `Patient account has been ${action} successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patient-portal-status'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update account status',
        variant: 'destructive',
      });
    },
  });

  // Delete patient mutation (admin-only edge function)
  const deletePatientMutation = useMutation({
    mutationFn: async (email: string) => {
      if (!email) throw new Error('Patient email missing');
      const { data, error } = await supabase.functions.invoke('cleanup-test-data', {
        body: { email }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Patient deleted', description: 'All patient records were removed.' });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
    onError: (err: any) => {
      toast({ title: 'Delete failed', description: err?.message || 'Could not delete patient', variant: 'destructive' });
    }
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

  const handleToggleAccountStatus = useCallback((patient: any) => {
    setPatientToToggle(patient);
    setDisableDialogOpen(true);
  }, []);

  const confirmToggleStatus = useCallback(() => {
    if (patientToToggle) {
      togglePatientStatusMutation.mutate({
        patientId: patientToToggle.id,
        currentStatus: patientToToggle.status || 'active',
      });
      setDisableDialogOpen(false);
      setPatientToToggle(null);
    }
  }, [patientToToggle, togglePatientStatusMutation]);

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
              <TableHead>Portal Status</TableHead>
              {isAdmin && <TableHead>Practice</TableHead>}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 7 : 6} className="text-center">
                  Loading patients...
                </TableCell>
              </TableRow>
            ) : filteredPatients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-muted-foreground">
                  {searchQuery ? "No patients found matching your search." : "No patients found. Add your first patient to get started."}
                </TableCell>
              </TableRow>
            ) : (
              paginatedPatients?.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell className="font-medium">
                    {patient.name || 
                      (patient.first_name && patient.last_name 
                        ? `${patient.first_name} ${patient.last_name}`.trim() 
                        : patient.first_name || patient.last_name || patient.email?.split('@')[0] || 'Unknown')}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatPatientEmail(patient.email)}</TableCell>
                  <TableCell>{formatPhoneNumber(patient.phone)}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {(() => {
                      if (patient.address_formatted) return patient.address_formatted;
                      
                      const street = patient.address_street || patient.address || '';
                      const city = patient.address_city || patient.city || '';
                      const state = patient.address_state || patient.state || '';
                      const zip = patient.address_zip || patient.zip_code || '';
                      
                      if (!street && !city && !state && !zip) {
                        return <span className="text-muted-foreground italic">No address on file</span>;
                      }
                      
                      return `${street}${city ? ', ' + city : ''}${state ? ', ' + state : ''}${zip ? ' ' + zip : ''}`.trim();
                    })()}
                  </TableCell>
                  <TableCell>
                    <PatientPortalStatusBadge
                      userId={patient.user_id}
                      lastLoginAt={patient.last_login_at}
                      status={patient.status}
                    />
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      {patient.practice?.name || "-"}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
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
                      
                      {isAdmin && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (!patient?.email) {
                                    toast({ title: 'Missing email', description: 'Cannot delete patient without email', variant: 'destructive' });
                                    return;
                                  }
                                  if (confirm(`Delete ${patient.name || patient.email}? This will remove all related data.`)) {
                                    deletePatientMutation.mutate((patient.email as string).toLowerCase());
                                  }
                                }}
                                disabled={deletePatientMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete Patient</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      
                      {!isAdmin && (
                        <>
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
                                <TooltipContent>
                                  <div className="text-xs max-w-xs">
                                    <p className="font-medium">Grant Portal Access</p>
                                    <p className="text-muted-foreground mt-1">
                                      Creates a portal account and sends invitation email to the patient
                                    </p>
                                  </div>
                                </TooltipContent>
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

                          {/* Disable/Enable Account Button */}
                          {patient.user_id && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleToggleAccountStatus(patient)}
                                    disabled={togglePatientStatusMutation.isPending}
                                  >
                                    {patient.status === 'disabled' ? (
                                      <CheckCircle className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <Ban className="h-4 w-4 text-destructive" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {patient.status === 'disabled' ? 'Enable Account' : 'Disable Account'}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </>
                      )}
                    </div>
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

      {/* Disable/Enable Account Confirmation Dialog */}
      <AlertDialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {patientToToggle?.status === 'disabled' ? 'Enable' : 'Disable'} Patient Account?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {patientToToggle?.status === 'disabled' ? (
                <>
                  This will re-enable portal access for{' '}
                  <span className="font-semibold">
                    {patientToToggle?.name || patientToToggle?.email}
                  </span>
                  . They will be able to log in to the portal again.
                </>
              ) : (
                <>
                  This patient will not be able to log in to the portal. You can re-enable their account at any time.
                  <br /><br />
                  Are you sure you want to disable portal access for{' '}
                  <span className="font-semibold">
                    {patientToToggle?.name || patientToToggle?.email}
                  </span>
                  ?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDisableDialogOpen(false);
              setPatientToToggle(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmToggleStatus}
              className={patientToToggle?.status === 'disabled' ? '' : 'bg-destructive hover:bg-destructive/90'}
            >
              {patientToToggle?.status === 'disabled' ? 'Enable Account' : 'Disable Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
