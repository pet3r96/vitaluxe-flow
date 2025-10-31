import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MessageSquare, FileText, Activity, AlertCircle, Clock, Pill, Video, Building } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function PatientDashboard() {
  const navigate = useNavigate();

  // Fetch patient account info
  const { data: patientAccount, isLoading: loadingAccount } = useQuery({
    queryKey: ["patient-account-dashboard"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      // Check for impersonation
      const { data: impersonationData } = await supabase.functions.invoke('get-active-impersonation');
      const effectiveUserId = impersonationData?.session?.impersonated_user_id || user.id;
      
      console.log('[PatientDashboard] 👤 Effective user ID:', effectiveUserId, '| Is impersonating:', !!impersonationData?.session);
      
      const { data, error } = await supabase
        .from("patient_accounts")
        .select("id, first_name, last_name, practice_id")
        .eq("user_id", effectiveUserId)
        .maybeSingle();
      
      if (error) throw error;
      console.log('[PatientDashboard] ✅ Patient account found:', data?.id, '| Name:', data?.first_name, data?.last_name);
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch medical vault status
  const { data: medicalVault, isLoading: loadingVault } = useQuery({
    queryKey: ["patient-medical-vault-status", patientAccount?.id],
    queryFn: async () => {
      if (!patientAccount?.id) return null;
      
      const { data, error } = await supabase
        .from("patient_medical_vault")
        .select("id, blood_type, allergies, current_medications, medical_conditions, updated_at")
        .eq("patient_id", patientAccount.id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!patientAccount?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch next upcoming appointment
  const { data: nextAppointment, isLoading: loadingAppt, error: nextAppointmentError } = useQuery({
    queryKey: ["next-appointment", patientAccount?.id],
    queryFn: async () => {
      if (!patientAccount?.id) {
        console.log('[PatientDashboard] ⚠️ No patient account ID');
        return null;
      }
      
      console.log('[PatientDashboard] 🔍 Fetching next appointment for patient_id:', patientAccount.id);
      
      // Simplified query without FK traversals
      const { data: appt, error } = await supabase
        .from("patient_appointments")
        .select('id, start_time, end_time, visit_type, status, practice_id, provider_id')
        .eq("patient_id", patientAccount.id)
        .gte("start_time", new Date().toISOString())
        .in('status', ['scheduled', 'pending'])
        .order("start_time", { ascending: true })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('[PatientDashboard] ❌ Error fetching next appointment:', error);
        if (error.code !== 'PGRST116') throw error;
        return null;
      }
      
      if (!appt) {
        console.log('[PatientDashboard] ℹ️ No next appointment found');
        return null;
      }

      // Fetch practice name from branding
      const { data: branding } = await supabase
        .from('practice_branding')
        .select('practice_name')
        .eq('practice_id', appt.practice_id)
        .maybeSingle();

      console.log('[PatientDashboard] ✅ Next appointment data:', appt, '| Practice:', branding?.practice_name);
      return {
        ...appt,
        practice: { name: branding?.practice_name || 'Practice' }
      };
    },
    enabled: !!patientAccount?.id,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch unread messages count
  const { data: unreadCount = 0, isLoading: loadingMessages } = useQuery({
    queryKey: ["unread-messages-count", patientAccount?.id],
    queryFn: async () => {
      if (!patientAccount?.id) return 0;
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return 0;

        // Check for impersonation
        const { data: impersonationData } = await supabase.functions.invoke('get-active-impersonation');
        const effectiveUserId = impersonationData?.session?.impersonated_user_id || user.id;
        
        console.log('[PatientDashboard] 📧 Fetching messages for user:', effectiveUserId);

        // Get thread IDs where user is a participant
        const { data: participantThreads, error: participantError } = await supabase
          .from("thread_participants")
          .select("thread_id")
          .eq("user_id", effectiveUserId);

        if (participantError) throw participantError;
        
        const threadIds = participantThreads?.map(pt => pt.thread_id) || [];
        if (threadIds.length === 0) return 0;

        // Get threads with latest messages
        const { data: threads, error: threadsError } = await supabase
          .from("message_threads")
          .select(`
            id,
            messages!inner(created_at, sender_id)
          `)
          .in("id", threadIds);

        if (threadsError) throw threadsError;

        // Count threads where latest message is not from current user
        const unreadThreads = threads?.filter((thread: any) => {
          const messages = Array.isArray(thread.messages) ? thread.messages : [thread.messages];
          const latestMessage = messages.sort((a: any, b: any) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0];
          return latestMessage?.sender_id !== effectiveUserId;
        }) || [];

        console.log('[PatientDashboard] 📧 Found', unreadThreads.length, 'unread messages');
        return unreadThreads.length;
      } catch (error) {
        console.error("Failed to fetch unread count:", error);
        return 0;
      }
    },
    enabled: !!patientAccount?.id,
    staleTime: 1 * 60 * 1000,
  });

  // Fetch recent appointments (past 3)
  const { data: recentAppointments = [], error: recentAppointmentsError } = useQuery({
    queryKey: ["recent-appointments", patientAccount?.id],
    queryFn: async () => {
      if (!patientAccount?.id) {
        console.log('[PatientDashboard] ⚠️ No patient account for recent appointments');
        return [];
      }
      
      console.log('[PatientDashboard] 🔍 Fetching recent appointments for patient_id:', patientAccount.id);
      
      // Simplified query - include more statuses for past appointments
      const { data: appts, error } = await supabase
        .from("patient_appointments")
        .select('id, start_time, end_time, status, visit_summary_url, practice_id, provider_id')
        .eq("patient_id", patientAccount.id)
        .lt("start_time", new Date().toISOString())
        .in('status', ['scheduled', 'completed', 'cancelled', 'no_show'])
        .order("start_time", { ascending: false })
        .limit(3);
      
      if (error) {
        console.error('[PatientDashboard] ❌ Error fetching recent appointments:', error);
        throw error;
      }

      if (!appts || appts.length === 0) {
        console.log('[PatientDashboard] ℹ️ No recent appointments');
        return [];
      }

      // Fetch practice names from branding
      const practiceIds = Array.from(new Set(appts.map(a => a.practice_id)));
      const { data: brandings } = await supabase
        .from('practice_branding')
        .select('practice_id, practice_name')
        .in('practice_id', practiceIds);

      const mapped = appts.map(appt => ({
        ...appt,
        practice: {
          name: brandings?.find(b => b.practice_id === appt.practice_id)?.practice_name || 'Practice'
        }
      }));
      
      console.log('[PatientDashboard] ✅ Recent appointments:', mapped.length, 'appointments');
      return mapped;
    },
    enabled: !!patientAccount?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch recent messages (3 most recent)
  const { data: recentMessages = [] } = useQuery({
    queryKey: ["recent-messages", patientAccount?.id],
    queryFn: async () => {
      if (!patientAccount?.id) return [];
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        // Check for impersonation
        const { data: impersonationData } = await supabase.functions.invoke('get-active-impersonation');
        const effectiveUserId = impersonationData?.session?.impersonated_user_id || user.id;
        
        console.log('[PatientDashboard] 💬 Fetching recent messages for user:', effectiveUserId);

        // Get thread IDs where user is a participant
        const { data: participantThreads } = await supabase
          .from("thread_participants")
          .select("thread_id")
          .eq("user_id", effectiveUserId);

        const threadIds = participantThreads?.map(pt => pt.thread_id) || [];
        if (threadIds.length === 0) return [];

        // Get recent threads with messages
        const { data, error } = await supabase
          .from("message_threads")
          .select(`
            id,
            subject,
            created_at,
            messages!inner(
              id,
              message_body,
              created_at,
              sender_id,
              sender:profiles!messages_sender_id_fkey(name)
            )
          `)
          .in("id", threadIds)
          .order("created_at", { ascending: false })
          .limit(3);

        if (error) throw error;
        
        // Transform to flat structure with latest message info
        return data?.map((thread: any) => {
          const messages = Array.isArray(thread.messages) ? thread.messages : [thread.messages];
          const latestMessage = messages.sort((a: any, b: any) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0];
          
          return {
            id: thread.id,
            subject: thread.subject,
            message_body: latestMessage?.message_body,
            created_at: latestMessage?.created_at || thread.created_at,
            read_at: latestMessage?.sender_id === effectiveUserId ? new Date().toISOString() : null,
            sender: latestMessage?.sender
          };
        }) || [];
        console.log('[PatientDashboard] 💬 Found', data?.length || 0, 'recent message threads');
      } catch (error) {
        console.error("Failed to fetch recent messages:", error);
        return [];
      }
    },
    enabled: !!patientAccount?.id,
    staleTime: 2 * 60 * 1000,
  });

  // Check if medical vault is complete
  const isMedicalVaultComplete = (vault: any) => {
    if (!vault) return false;
    const hasAllergies = vault.allergies && Array.isArray(vault.allergies) && vault.allergies.length > 0;
    const hasMedications = vault.current_medications && Array.isArray(vault.current_medications);
    return !!(vault.blood_type && hasAllergies && hasMedications);
  };

  const vaultComplete = isMedicalVaultComplete(medicalVault);
  const allergiesArray = Array.isArray(medicalVault?.allergies) ? medicalVault.allergies : [];
  const medicationsArray = Array.isArray(medicalVault?.current_medications) ? medicalVault.current_medications : [];
  const conditionsArray = Array.isArray(medicalVault?.medical_conditions) ? medicalVault.medical_conditions : [];
  const medicationCount = medicationsArray.length;

  if (loadingAccount) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome, {patientAccount?.first_name || 'Patient'}
        </h1>
        <p className="text-muted-foreground">Your personal health dashboard</p>
      </div>

      {/* Medical Vault Onboarding Alert */}
      {!loadingVault && !vaultComplete && (
        <Alert className="border-warning bg-warning/10">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Complete Your Medical Vault</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>Help your healthcare team provide better care by completing your medical information.</span>
            <Button 
              variant="default" 
              size="sm" 
              className="ml-4"
              onClick={() => navigate('/medical-vault')}
            >
              Get Started
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Next Appointment Card */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/appointments")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Appointment</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingAppt ? (
              <Skeleton className="h-8 w-24" />
            ) : nextAppointment ? (
              <>
                <div className="text-lg font-bold">
                  {format(new Date(nextAppointment.start_time), "MMM dd")}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {nextAppointment.visit_type === 'virtual' ? (
                    <><Video className="h-3 w-3" /> Virtual</>
                  ) : (
                    <><Building className="h-3 w-3" /> In-Person</>
                  )}
                  {' • '}
                  {format(new Date(nextAppointment.start_time), "h:mm a")}
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">None</div>
                <p className="text-xs text-muted-foreground">No upcoming visits</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Unread Messages Card */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/messages")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unread Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingMessages ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{unreadCount}</div>
                <p className="text-xs text-muted-foreground">From providers</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Medication Reminders Card */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/medical-vault")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Medications</CardTitle>
            <Pill className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingVault ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <>
                <div className="text-2xl font-bold">{medicationCount}</div>
                <p className="text-xs text-muted-foreground">Current prescriptions</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Medical Vault Status Card */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/medical-vault")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Medical Vault</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingVault ? (
              <Skeleton className="h-8 w-20" />
            ) : medicalVault ? (
              <>
                <div className="text-lg font-bold">
                  {vaultComplete ? 'Complete' : 'Incomplete'}
                </div>
                <p className="text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 inline mr-1" />
                  {formatDistanceToNow(new Date(medicalVault.updated_at), { addSuffix: true })}
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">Empty</div>
                <p className="text-xs text-muted-foreground">Not yet set up</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Section */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Appointments */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Appointments</CardTitle>
            <CardDescription>Your past visits</CardDescription>
          </CardHeader>
          <CardContent>
            {recentAppointments.length > 0 ? (
              <div className="space-y-3">
                {recentAppointments.map((appt: any) => (
                  <div key={appt.id} className="flex justify-between items-start p-3 border rounded-lg">
                    <div className="space-y-1">
                      <p className="font-medium">{appt.practice?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(appt.start_time), "MMM dd, yyyy")}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {appt.status}
                      </Badge>
                    </div>
                    {appt.visit_summary_url && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => window.open(appt.visit_summary_url, '_blank')}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recent appointments</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Messages */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Messages</CardTitle>
            <CardDescription>Latest communications</CardDescription>
          </CardHeader>
          <CardContent>
            {recentMessages.length > 0 ? (
              <div className="space-y-3">
                {recentMessages.map((msg: any) => (
                  <div 
                    key={msg.id} 
                    className="p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => navigate("/messages")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{msg.subject}</p>
                          {!msg.read_at && (
                            <Badge variant="default" className="text-xs shrink-0">New</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          From: {msg.sender?.name || 'Provider'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recent messages</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Medical Vault Snapshot */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/appointments")}>
              <Calendar className="mr-2 h-4 w-4" />
              Book Appointment
            </Button>
            <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/medical-vault")}>
              <Activity className="mr-2 h-4 w-4" />
              Update Medical Vault
            </Button>
            <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/messages")}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Message Provider
            </Button>
            <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/documents")}>
              <FileText className="mr-2 h-4 w-4" />
              View Documents
            </Button>
          </CardContent>
        </Card>

        {/* Medical Vault Snapshot */}
        <Card>
          <CardHeader>
            <CardTitle>Medical Vault Snapshot</CardTitle>
            <CardDescription>Key health information</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingVault ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : medicalVault ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Blood Type:</span>
                  <span className="text-sm font-medium">{medicalVault.blood_type || 'Not set'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Allergies:</span>
                  <span className="text-sm font-medium">
                    {allergiesArray.length} recorded
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Medications:</span>
                  <span className="text-sm font-medium">
                    {medicationsArray.length} active
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Conditions:</span>
                  <span className="text-sm font-medium">
                    {conditionsArray.length} listed
                  </span>
                </div>
                <Button 
                  className="w-full mt-4" 
                  variant="outline"
                  onClick={() => navigate("/medical-vault")}
                >
                  View Full Vault
                </Button>
              </div>
            ) : (
              <div className="text-center py-6">
                <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-4">
                  Your medical vault is empty
                </p>
                <Button onClick={() => navigate("/medical-vault")}>
                  Set Up Now
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
