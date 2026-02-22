import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppointmentBookingDialog } from "@/components/patient/AppointmentBookingDialog";
import { RescheduleRequestDialog } from "@/components/patient/RescheduleRequestDialog";
import { format, differenceInMinutes } from "date-fns";
import { Calendar, Clock, MapPin, Download, Building } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { usePatientPracticeSubscription } from "@/hooks/usePatientPracticeSubscription";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { logger } from "@/lib/logger";
import { usePagePerformance } from "@/hooks/usePagePerformance";

export default function PatientAppointments() {
  usePagePerformance('PatientAppointments');
  const {
    isSubscribed: practiceHasSubscription, 
    practiceName,
    loading: subscriptionLoading,
    reason: subscriptionReason,
    status: subscriptionStatus
  } = usePatientPracticeSubscription();

  logger.info('[PatientAppointments] Subscription state', {
    practiceHasSubscription,
    subscriptionLoading,
    subscriptionStatus,
    subscriptionReason
  });

  interface PatientAppointment {
    id: string;
    start_time: string;
    end_time: string;
    status: string;
    appointment_type: string;
    reason_for_visit?: string;
    provider_id?: string;
    practice_id: string;
    notes?: string;
    practice?: { id: string; name?: string; address?: string };
    providers?: { id: string; name?: string };
  }

  const [bookingOpen, setBookingOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<PatientAppointment | null>(null);
  const isMobile = useIsMobile();
  const { effectiveUserId } = useAuth();
  const navigate = useNavigate();
 
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  // Cache key includes effectiveUserId to prevent data leakage across impersonations
  const { data: appointments, refetch } = useQuery<PatientAppointment[]>({
    queryKey: ["patient-appointments", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) throw new Error('No effective user ID');

      logger.info('[PatientAppointments] Fetching appointments for user ID', { userId: effectiveUserId });

      // 1) Try RPC first
      let shouldUseFallback = false;
      try {
        const { data, error } = await supabase
          .rpc('get_patient_appointments_with_details', { p_user_id: effectiveUserId });
        
        if (error) {
          logger.warn('[PatientAppointments] RPC error', { message: error.message });
          shouldUseFallback = true;
        } else {
          // RPC returns appointments array directly
          logger.info('[PatientAppointments] Raw RPC response', { preview: JSON.stringify(data).substring(0, 200) });
          const rows = Array.isArray(data) ? data : [];
          logger.info('[PatientAppointments] Extracted appointments count', { count: rows?.length || 0 });
          
          // If RPC returns empty or invalid, use fallback
          if (!rows || rows.length === 0) {
            logger.info('[PatientAppointments] RPC returned empty, using fallback');
            shouldUseFallback = true;
          } else {

        // Enrich RPC results with practice address/name when missing
        const practiceIds = Array.from(
          new Set(
            rows
              .map((r: any) => r.practice_id || r.practice?.id)
              .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
          )
        );
        let profilesById: Record<string, any> = {};
        let brandingByPracticeId: Record<string, any> = {};
        if (practiceIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, address_street, address_suite, address_city, address_state, address_zip, name, company')
            .in('id', practiceIds as string[]);
          
          (profilesData || []).forEach((p: any) => { profilesById[p.id] = p; });
        }

        const enhanced = rows.map((r: any) => {
          const pid = r.practice_id || r.practice?.id;
          const profile = pid ? profilesById[pid] : null;
          const addrStreet = r.street || r.practice?.address_street || profile?.address_street || null;
          const addrCity = r.city || r.practice?.address_city || profile?.address_city || null;
          const addrState = r.state || r.practice?.address_state || profile?.address_state || null;
          const addrZip = r.zip || r.practice?.address_zip || profile?.address_zip || null;
          const formatted = (addrStreet && addrCity) ? `${addrStreet}, ${addrCity}, ${addrState || ''} ${addrZip || ''}`.trim() : null;

          return {
            ...r,
            practice: {
              id: pid,
              name: r.practice?.name || profile?.company || profile?.name || 'Practice',
              address_formatted: formatted,
              address_street: addrStreet,
              address_city: addrCity,
              address_state: addrState,
              address_zip: addrZip,
            },
          };
        });

            return enhanced;
          }
        }
      } catch (rpcError: any) {
        logger.warn('[PatientAppointments] RPC failed completely', { message: rpcError.message });
        shouldUseFallback = true;
      }

      // 2) Fallback: direct queries with RLS-safe selects (always run if RPC failed or returned empty)
      if (shouldUseFallback) {
        logger.info('[PatientAppointments] Using fallback direct query');
        const { data: patientAccount, error: paErr } = await supabase
          .from('patient_accounts')
          .select('id, practice_id')
          .eq('user_id', effectiveUserId)
          .maybeSingle();
        
        if (paErr) {
          logger.error('[PatientAppointments] Patient account lookup error', paErr);
          throw paErr;
        }
        
        if (!patientAccount) {
          logger.warn('[PatientAppointments] No patient account found for user', { userId: effectiveUserId });
          // Return empty array with helpful context
          return [];
        }
        
        logger.info('[PatientAppointments] Patient account found', { patientId: patientAccount.id });

        const { data: apptRows, error: apptErr } = await supabase
          .from('patient_appointments')
          .select('id,start_time,end_time,status,confirmation_type,visit_type,reason_for_visit,notes,visit_summary_url,practice_id,provider_id')
          .eq('patient_id', patientAccount.id)
          .order('start_time', { ascending: false });
        if (apptErr) throw apptErr;
        const rows = apptRows || [];
        
        logger.info('[PatientAppointments] Fallback query result count', { count: rows.length });

        // Fetch providers and their profiles for display_name
        const providerIds = Array.from(new Set(rows.map((r: any) => r.provider_id).filter(Boolean)));
        let providers: Array<{ id: string; [key: string]: unknown }> = [];
        let profiles: Array<{ id: string; [key: string]: unknown }> = [];
        if (providerIds.length > 0) {
          const { data: provs } = await supabase
            .from('providers')
            .select('id,user_id')
            .in('id', providerIds);
          providers = provs || [];
          const userIds = Array.from(new Set(providers.map(p => p.user_id as string).filter(Boolean)));
          if (userIds.length > 0) {
            const { data: profs } = await supabase
              .from('profiles')
              .select('id, full_name, name')
              .in('id', userIds);
            profiles = profs || [];
          }
        }

        // Fetch practice address and name from profiles
        const { data: practiceProfile } = await supabase
          .from('profiles')
          .select('name, company, address_street, address_suite, address_city, address_state, address_zip')
          .eq('id', patientAccount.practice_id)
          .maybeSingle();

        const mapped = rows.map((r: any) => {
          const prov = providers.find(p => p.id === r.provider_id);
          const prof = prov ? profiles.find(pr => pr.id === prov.user_id) : null;
          
          // Use appointment address if available, otherwise fallback to practice profile address
          const addrStreet = r.street || practiceProfile?.address_street || null;
          const addrCity = r.city || practiceProfile?.address_city || null;
          const addrState = r.state || practiceProfile?.address_state || null;
          const addrZip = r.zip || practiceProfile?.address_zip || null;
          const addrSuite = r.suite || practiceProfile?.address_suite || null;
          const formatted = (addrStreet && addrCity) 
            ? [addrStreet, addrSuite, addrCity, `${addrState || ''} ${addrZip || ''}`].filter(Boolean).join(', ').trim() 
            : null;

          return {
            ...r,
            practice: {
              id: r.practice_id,
              name: practiceProfile?.company || practiceProfile?.name || 'Practice',
              address_formatted: formatted,
              address_street: addrStreet,
              address_city: addrCity,
              address_state: addrState,
              address_zip: addrZip,
            },
            provider: prov ? {
              id: prov.id,
              display_name: prof?.full_name || prof?.name || 'Provider'
            } : null,
          };
        });

        return mapped;
      }
      
      // Should never reach here, but TypeScript needs this
      return [];
    },
    enabled: !!effectiveUserId,
  });

  const handleCancelAppointment = (appointmentId: string) => {
    setCancelId(appointmentId);
    setCancelOpen(true);
  };

  const confirmCancel = async () => {
    if (!cancelId) return;
    try {
      setIsCancelling(true);
      
      // Get CSRF token for security
      const { getCurrentCSRFToken } = await import("@/lib/csrf");
      const csrfToken = await getCurrentCSRFToken();
      
      if (!csrfToken) {
        throw new Error("Security token unavailable. Please refresh and try again.");
      }

      const { data, error } = await supabase.functions.invoke("cancel-appointment", {
        body: { 
          appointmentId: cancelId,
          csrfToken 
        },
        headers: {
          "x-csrf-token": csrfToken
        }
      });
      if (error) throw error;

      // Optimistically remove from cache so it disappears immediately
      queryClient.setQueryData(["patient-appointments", effectiveUserId], (old: Array<Record<string, unknown>> | undefined) => {
        if (!old) return old;
        return old.filter((a) => a.id !== cancelId);
      });

      // Invalidate calendar-related queries to ensure calendar updates
      queryClient.invalidateQueries({ queryKey: ["calendar-data"] });
      queryClient.invalidateQueries({ queryKey: ["patient_appointments"] });

      toast.success("Appointment cancelled");
      setCancelOpen(false);
      setCancelId(null);
      // Ensure server state sync
      refetch();
    } catch (error: any) {
      logger.error("Cancel appointment failed", error);
      toast.error(error.message || "Failed to cancel appointment");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleAddToCalendar = async (appointmentId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("export-calendar-ics", {
        body: { appointmentId },
      });

      if (error) throw error;

      // Handle different response formats
      let icsContent: string;
      let filename: string;
      
      if (typeof data === 'string') {
        icsContent = data;
        filename = `appointment-${appointmentId}.ics`;
      } else if (data?.ics) {
        icsContent = data.ics;
        filename = data.filename || `appointment-${appointmentId}.ics`;
      } else {
        throw new Error('Invalid response format');
      }

      // Create blob and download
      const blob = new Blob([icsContent], { type: 'text/calendar' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Calendar event downloaded");
    } catch (error: any) {
      logger.error("Error generating calendar event", error);
      toast.error(error.message || "Failed to generate calendar event");
    }
  };

  const getConfirmationBadge = (confirmationType: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      'pending': { variant: 'secondary', label: 'Pending' },
      'confirmed': { variant: 'default', label: 'Confirmed' },
      'modified_by_practice': { variant: 'outline', label: 'Modified by Practice' }
    };
    const config = variants[confirmationType] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getVisitTypeBadge = (visitType: string) => {
    return <Badge variant="outline" className="gap-1"><Building className="h-3 w-3" />In-Person</Badge>;
  };

  const upcoming = appointments?.filter((a: any) => new Date(a.start_time) >= new Date() && a.status !== 'cancelled') || [];
  const past = appointments?.filter((a: any) => new Date(a.start_time) < new Date()) || [];
  
  logger.info('[PatientAppointments] 📊 Past/Upcoming counts', { pastCount: past.length, upcomingCount: upcoming.length });

  return (
    <div className="patient-container">
      <div className="flex flex-col items-center gap-4 mb-6">
        <div className="text-center">
          <h1 className="patient-section-header">My Appointments</h1>
          <p className="text-muted-foreground text-sm md:text-base">Manage your scheduled visits</p>
        </div>
        
        {subscriptionLoading && (
          <Alert className="max-w-2xl border-blue-200 bg-blue-50 dark:bg-blue-950/20">
            <Building className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800 dark:text-blue-200">Checking availability...</AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              Verifying your practice subscription status.
            </AlertDescription>
          </Alert>
        )}

        {!subscriptionLoading && !practiceHasSubscription && (
          <Alert className="max-w-2xl">
            <Lock className="h-4 w-4" />
            <AlertTitle>Feature Temporarily Unavailable</AlertTitle>
            <AlertDescription>
              {practiceName ? `${practiceName}'s` : 'Your practice'} subscription has expired. 
              You can view your existing appointments, but booking new appointments is currently unavailable. 
              Please contact your practice for assistance.
            </AlertDescription>
          </Alert>
        )}

        <Button 
          onClick={() => setBookingOpen(true)} 
          className="touch-target"
          disabled={!subscriptionLoading && !practiceHasSubscription}
        >
          <Calendar className="mr-2 h-4 w-4" />
          {subscriptionLoading ? 'Checking...' : 'Book Appointment'}
        </Button>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold mb-4">Upcoming</h2>
          {upcoming.length === 0 ? (
            <Card className="patient-card">
              <CardContent className="py-8 text-center text-muted-foreground">
                No upcoming appointments
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {upcoming.map((appt: any) => (
                <Card key={appt.id} className="patient-card patient-card-hover">
                  <CardHeader>
                    <div className={isMobile ? 'space-y-3' : 'flex justify-between items-start'}>
                      <div className="flex-1">
                        <CardTitle className={isMobile ? 'text-lg' : ''}>{practiceName || appt.practice?.name || 'Practice'}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Clock className="h-3 w-3" />
                          <span className={isMobile ? 'text-xs' : ''}>
                            {format(new Date(appt.start_time), "EEEE, MMMM dd, yyyy 'at' h:mm a")}
                          </span>
                        </CardDescription>
                      </div>
                      <div className={`flex gap-2 ${isMobile ? 'flex-row' : 'flex-col items-end'}`}>
                        {getConfirmationBadge(appt.confirmation_type)}
                        {appt.visit_type && getVisitTypeBadge(appt.visit_type)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {appt.reason_for_visit && (
                      <div>
                        <p className="text-sm font-medium">Reason for Visit</p>
                        <p className="text-sm text-muted-foreground">{appt.reason_for_visit}</p>
                      </div>
                    )}
                    {appt.provider && (
                      <p className="text-sm">Provider: {appt.provider.display_name}</p>
                    )}

                    {/* Video Join Section - Feature disabled, coming soon */}
                    {/* Video appointments are currently disabled */}

                    {appt.practice && appt.visit_type !== 'video' && (
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 mt-0.5" />
                        <span>
                          {(() => {
                            const formatted = appt.practice.address_formatted;
                            if (formatted) return formatted;
                            const parts = [
                              appt.practice.address_street,
                              appt.practice.address_city,
                              appt.practice.address_state,
                              appt.practice.address_zip
                            ].filter(Boolean);
                            return parts.length ? parts.join(', ') : 'Contact practice for address details';
                          })()}
                        </span>
                      </div>
                    )}
                    {appt.notes && (
                      <p className="text-sm text-muted-foreground">Notes: {appt.notes}</p>
                    )}
                    <div className={`flex gap-2 ${isMobile ? 'flex-col' : 'flex-wrap'}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedAppointment(appt);
                          setRescheduleOpen(true);
                        }}
                        className={isMobile ? 'w-full justify-center' : ''}
                      >
                        Request Reschedule
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddToCalendar(appt.id)}
                        className={isMobile ? 'w-full justify-center' : ''}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Add to Calendar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleCancelAppointment(appt.id)}
                        className={isMobile ? 'w-full justify-center' : ''}
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-xl md:text-2xl font-semibold mb-4">Past Appointments</h2>
          {past.length === 0 ? (
            <Card className="patient-card">
              <CardContent className="py-8 text-center text-muted-foreground">
                No past appointments
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {past.map((appt: any) => (
                <Card key={appt.id} className="opacity-75">
                  <CardHeader>
                    <div className={isMobile ? 'space-y-3' : 'flex justify-between items-start'}>
                      <div className="flex-1">
                        <CardTitle className="text-base">{appt.practice?.name}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Clock className="h-3 w-3" />
                          <span className={isMobile ? 'text-xs' : ''}>
                            {format(new Date(appt.start_time), "EEEE, MMMM dd, yyyy 'at' h:mm a")}
                          </span>
                        </CardDescription>
                        {appt.reason_for_visit && (
                          <p className="text-sm text-muted-foreground mt-1">{appt.reason_for_visit}</p>
                        )}
                      </div>
                      <div className={`flex gap-2 ${isMobile ? 'flex-row' : 'flex-col items-end'}`}>
                        <Badge variant="outline">{appt.status}</Badge>
                        {appt.visit_type && getVisitTypeBadge(appt.visit_type)}
                      </div>
                    </div>
                  </CardHeader>
                  {appt.visit_summary_url && (
                    <CardContent>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(appt.visit_summary_url, '_blank')}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        View Visit Summary
                      </Button>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <AppointmentBookingDialog open={bookingOpen} onOpenChange={setBookingOpen} onSuccess={refetch} />
      {selectedAppointment && (
        <RescheduleRequestDialog 
          open={rescheduleOpen} 
          onOpenChange={setRescheduleOpen} 
          appointment={selectedAppointment}
          onSuccess={refetch}
        />
      )}

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the visit from your upcoming list and the practice calendar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Keep Appointment</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} disabled={isCancelling}>
              {isCancelling ? "Cancelling..." : "Yes, Cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
