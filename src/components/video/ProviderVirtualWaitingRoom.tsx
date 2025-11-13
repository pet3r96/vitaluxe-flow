import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Video, User, Clock, Circle, Plus, Loader2, Check, Calendar, Link2, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, isToday, differenceInMinutes } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { VideoSessionStatus } from "./VideoSessionStatus";
import { AppointmentCountdown } from "./AppointmentCountdown";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { CreateAppointmentDialog } from "@/components/calendar/CreateAppointmentDialog";
import { VideoGuestLinkDialog } from "./VideoGuestLinkDialog";
import { realtimeManager } from "@/lib/realtimeManager";
import { getProviderDisplayName } from "@/utils/providerNameUtils";
import { createInstantMeeting } from "@/utils/createInstantMeeting";
import { useProvidersAndStaff } from "@/hooks/useProvidersAndStaff";
import { useMemo } from "react";

interface ProviderVirtualWaitingRoomProps {
  practiceId: string;
  onStartSession?: (sessionId: string) => void;
}

export const ProviderVirtualWaitingRoom = ({
  practiceId,
  onStartSession
}: ProviderVirtualWaitingRoomProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [creatingSession, setCreatingSession] = useState(false);
  const [guestLinkData, setGuestLinkData] = useState<{ url: string; expiresAt: string } | null>(null);
  const [showGuestLinkDialog, setShowGuestLinkDialog] = useState(false);
  const [generatingLink, setGeneratingLink] = useState<string | null>(null);
  const [startingSession, setStartingSession] = useState<string | null>(null);
  const [cancellingSession, setCancellingSession] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [sessionToCancel, setSessionToCancel] = useState<string | null>(null);
  const [completingAppointment, setCompletingAppointment] = useState<string | null>(null);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [appointmentToComplete, setAppointmentToComplete] = useState<string | null>(null);
  const [preparingSession, setPreparingSession] = useState<string | null>(null);

  // Helper function to display patient names consistently
  const getPatientDisplay = (p: { first_name?: string; last_name?: string; email?: string; id: string }) => {
    const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
    const base = name || 'Unknown Patient';
    return p.email ? `${base} (${p.email})` : base;
  };

  // Subscribe to realtime updates for instant UI updates
  useEffect(() => {
    realtimeManager.subscribe('patient_appointments');
    realtimeManager.subscribe('video_sessions');
    realtimeManager.subscribe('patient_accounts'); // Keep patient list fresh

    return () => {
      // Subscriptions are managed globally, no need to unsubscribe
    };
  }, []);

  const { data: videoSessions, isLoading } = useQuery({
    queryKey: ['provider-video-sessions', practiceId],
    queryFn: async () => {
      // Fix timezone issue: widen date range to capture appointments across timezones
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      
      const dayAfterTomorrow = new Date();
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      dayAfterTomorrow.setHours(23, 59, 59, 999);

      console.log('[ProviderVirtualWaitingRoom] Fetching video data with date range:', {
        from: yesterday.toISOString(),
        to: dayAfterTomorrow.toISOString()
      });

      // Query 1: Get existing video_sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('video_sessions')
        .select('*, patient_accounts!video_sessions_patient_id_fkey(id, first_name, last_name, name)')
        .eq('practice_id', practiceId)
        .gte('scheduled_start_time', yesterday.toISOString())
        .lt('scheduled_start_time', dayAfterTomorrow.toISOString())
        .in('status', ['created', 'scheduled', 'waiting', 'active'])
        .order('scheduled_start_time', { ascending: true });

      if (sessionsError) throw sessionsError;

      // Query 2: Get scheduled video appointments that might not have sessions yet
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('patient_appointments')
        .select('id, patient_id, provider_id, start_time, status')
        .eq('practice_id', practiceId)
        .eq('visit_type', 'video')
        .not('status', 'in', '("cancelled","completed")') // Exclude only terminal statuses
        .gte('start_time', yesterday.toISOString())
        .lt('start_time', dayAfterTomorrow.toISOString())
        .order('start_time', { ascending: true });

      if (appointmentsError) throw appointmentsError;

      // Merge both sources - prefer video_sessions if they exist
      const sessionsByAppointmentId = new Map(
        (sessionsData || []).map(s => [s.appointment_id, s])
      );

      console.log('[ProviderVirtualWaitingRoom] Sessions by appointment:', {
        mapSize: sessionsByAppointmentId.size,
        keys: Array.from(sessionsByAppointmentId.keys())
      });

      // Start with real video_sessions
      const merged = [...(sessionsData || [])];
      
      // Add appointments that don't have sessions yet
      (appointmentsData || []).forEach(apt => {
        if (!sessionsByAppointmentId.has(apt.id)) {
          console.log('[ProviderVirtualWaitingRoom] Creating synthetic session for appointment:', apt.id);
          // Create a session-like object from appointment
          merged.push({
            id: `apt-${apt.id}`,
            appointment_id: apt.id,
            patient_id: apt.patient_id,
            provider_id: apt.provider_id,
            scheduled_start_time: apt.start_time,
            status: apt.status === 'checked_in' ? 'waiting' : 'scheduled',
            patient_accounts: null, // Will be filled from patients query
          } as any);
        } else {
          console.log('[ProviderVirtualWaitingRoom] Real session exists for appointment:', apt.id);
        }
      });

      // Sort by scheduled time
      merged.sort((a, b) => 
        new Date(a.scheduled_start_time).getTime() - new Date(b.scheduled_start_time).getTime()
      );
      
      console.log('[ProviderVirtualWaitingRoom] ✅ Video data merged:', {
        sessions: sessionsData?.length || 0,
        appointments: appointmentsData?.length || 0,
        merged: merged.length,
        sample: merged.slice(0, 3).map(s => ({ 
          id: s.id, 
          status: s.status, 
          scheduled_start_time: s.scheduled_start_time,
          source: s.id.toString().startsWith('apt-') ? 'appointment' : 'session'
        }))
      });
      
      return merged;
    },
    refetchInterval: 2000, // Refresh every 2 seconds for instant updates
    refetchOnMount: 'always', // Force fresh data when component mounts
    refetchOnWindowFocus: true // Refresh when tab regains focus
  });

  // Fetch patients for instant session creation and scheduling
  const { data: patients, isLoading: patientsLoading, isError: patientsError } = useQuery({
    queryKey: ['practice-patients', practiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient_accounts')
        .select('id, first_name, last_name, email, primary_provider_id, provider_id')
        .eq('practice_id', practiceId)
        .order('last_name');
      
      if (error) throw error;
      
      console.log('[ProviderVirtualWaitingRoom] ✅ Patients loaded:', {
        count: data?.length || 0,
        sampleDisplay: data?.slice(0, 3).map(p => getPatientDisplay(p))
      });
      
      return data || [];
    },
    enabled: showCreateDialog || showScheduleDialog,
    staleTime: 60_000, // Keep data fresh for 1 minute
    refetchOnWindowFocus: false // Prevent flicker on quick open/close
  });

  // Prefetch patients when opening dialog
  useEffect(() => {
    if (showCreateDialog && practiceId) {
      queryClient.prefetchQuery({
        queryKey: ['practice-patients', practiceId],
        queryFn: async () => {
          const { data, error } = await supabase
            .from('patient_accounts')
            .select('id, first_name, last_name, email')
            .eq('practice_id', practiceId)
            .order('last_name');
          if (error) throw error;
          return data || [];
        }
      });
    }
  }, [showCreateDialog, practiceId, queryClient]);

  // Fetch providers and staff using direct database query
  const { data: allProviders, isLoading: providersLoading } = useProvidersAndStaff(practiceId);

  // Filter providers based on selected patient
  const filteredProviders = useMemo(() => {
    if (!selectedPatientId || !allProviders) return allProviders || [];
    
    const selectedPatient = patients?.find(p => p.id === selectedPatientId);
    if (!selectedPatient) return allProviders;
    
    // Filter to show only providers assigned to this patient
    const assignedProviderIds = [
      selectedPatient.primary_provider_id,
      selectedPatient.provider_id
    ].filter(Boolean);
    
    if (assignedProviderIds.length === 0) {
      // No assigned providers, show all
      return allProviders;
    }
    
    return allProviders.filter(p => assignedProviderIds.includes(p.id));
  }, [selectedPatientId, allProviders, patients]);

  // Helper function to check if a session is synthetic (not yet created in DB)
  const isSyntheticSession = (sessionId: string) => sessionId.startsWith('apt-');

  // Handler for "Prepare Session Now" button
  const handlePrepareSession = async (sessionId: string) => {
    setPreparingSession(sessionId);
    
    try {
      const appointmentId = sessionId.replace('apt-', '');
      console.log('[ProviderVirtualWaitingRoom] Preparing session for appointment:', appointmentId);
      
      const { data: ensureData, error: ensureError } = await supabase.functions.invoke('ensure-video-session', {
        body: { appointmentId }
      });
      
      if (ensureError || !ensureData?.sessionId) {
        throw new Error('Failed to prepare video session');
      }
      
      console.log('[ProviderVirtualWaitingRoom] ✅ Session prepared:', ensureData.sessionId);
      
      toast({
        title: "Session Prepared",
        description: "Video session is now ready. You can start it anytime."
      });
      
      // Trigger immediate refetch to update UI
      queryClient.refetchQueries({ queryKey: ['provider-video-sessions', practiceId] });
    } catch (error: any) {
      console.error('Error preparing session:', error);
      toast({
        title: "Preparation Failed",
        description: error.message || "Failed to prepare video session",
        variant: "destructive"
      });
    } finally {
      setPreparingSession(null);
    }
  };

  // Detect synthetic sessions and ensure refetch is active
  useEffect(() => {
    const hasSyntheticSessions = videoSessions?.some(s => isSyntheticSession(s.id));
    if (hasSyntheticSessions) {
      console.log('[ProviderVirtualWaitingRoom] Synthetic sessions detected, refetch active');
    }
  }, [videoSessions]);

  const handleStartSession = async (sessionId: string) => {
    setStartingSession(sessionId);
    console.time(`[ProviderVirtualWaitingRoom] start-video-session-${sessionId}`);
    
    try {
      let realSessionId = sessionId;
      
      // If synthetic session, create it first
      if (isSyntheticSession(sessionId)) {
        const appointmentId = sessionId.replace('apt-', '');
        console.log('[ProviderVirtualWaitingRoom] Creating session for appointment:', appointmentId);
        
        const { data: ensureData, error: ensureError } = await supabase.functions.invoke('ensure-video-session', {
          body: { appointmentId }
        });
        
        if (ensureError || !ensureData?.sessionId) {
          throw new Error('Failed to create video session');
        }
        
        realSessionId = ensureData.sessionId;
        console.log('[ProviderVirtualWaitingRoom] ✅ Session created:', realSessionId);
        
        // Trigger immediate refetch to update UI
        queryClient.refetchQueries({ queryKey: ['provider-video-sessions', practiceId] });
      }
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 12000)
      );
      
      const invokePromise = supabase.functions.invoke('start-video-session', {
        body: { sessionId: realSessionId }
      });

      const { error } = await Promise.race([invokePromise, timeoutPromise]) as any;
      console.timeEnd(`[ProviderVirtualWaitingRoom] start-video-session-${sessionId}`);

      if (error) throw error;

      toast({
        title: "Session Started",
        description: "Patient has been notified via SMS"
      });

      // Auto-join the provider to the video room after starting session
      navigate(`/practice/video/${realSessionId}`);
    } catch (error: any) {
      console.timeEnd(`[ProviderVirtualWaitingRoom] start-video-session-${sessionId}`);
      console.error('Error starting session:', error);
      
      if (error.message === 'timeout') {
        toast({
          title: "Still Processing",
          description: "Starting the session... We'll update automatically shortly."
        });
        setTimeout(() => {
          queryClient.refetchQueries({ queryKey: ['provider-video-sessions', practiceId] });
        }, 2000);
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to start video session",
          variant: "destructive"
        });
      }
    } finally {
      setStartingSession(null);
    }
  };

  const handleJoinSession = async (sessionId: string) => {
    let realSessionId = sessionId;
    
    // If synthetic session, create it first
    if (isSyntheticSession(sessionId)) {
      const appointmentId = sessionId.replace('apt-', '');
      console.log('[ProviderVirtualWaitingRoom] Creating session before joining:', appointmentId);
      
      try {
        const { data: ensureData, error: ensureError } = await supabase.functions.invoke('ensure-video-session', {
          body: { appointmentId }
        });
        
        if (ensureError || !ensureData?.sessionId) {
          toast({
            title: "Error",
            description: "Failed to create video session",
            variant: "destructive"
          });
          return;
        }
        
        realSessionId = ensureData.sessionId;
        console.log('[ProviderVirtualWaitingRoom] ✅ Session created:', realSessionId);
      } catch (error) {
        console.error('Error ensuring session:', error);
        toast({
          title: "Error",
          description: "Failed to prepare video session",
          variant: "destructive"
        });
        return;
      }
    }
    
    navigate(`/practice/video/${realSessionId}`);
  };

  const handleGenerateGuestLink = async (sessionId: string) => {
    setGeneratingLink(sessionId);
    console.time(`[ProviderVirtualWaitingRoom] generate-guest-link-${sessionId}`);
    
    try {
      let realSessionId = sessionId;
      
      // If synthetic session, create it first
      if (isSyntheticSession(sessionId)) {
        const appointmentId = sessionId.replace('apt-', '');
        console.log('[ProviderVirtualWaitingRoom] Creating session for guest link:', appointmentId);
        
        const { data: ensureData, error: ensureError } = await supabase.functions.invoke('ensure-video-session', {
          body: { appointmentId }
        });
        
        if (ensureError || !ensureData?.sessionId) {
          throw new Error('Failed to create video session');
        }
        
        realSessionId = ensureData.sessionId;
        console.log('[ProviderVirtualWaitingRoom] ✅ Session created:', realSessionId);
        
        // Trigger immediate refetch to update UI
        queryClient.refetchQueries({ queryKey: ['provider-video-sessions', practiceId] });
      }
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 12000)
      );
      
      const invokePromise = supabase.functions.invoke('generate-video-guest-link', {
        body: { sessionId: realSessionId }
      });

      const { data, error } = await Promise.race([invokePromise, timeoutPromise]) as any;
      console.timeEnd(`[ProviderVirtualWaitingRoom] generate-guest-link-${sessionId}`);

      if (error) throw error;

      setGuestLinkData({
        url: data.guestUrl,
        expiresAt: data.expiresAt
      });
      setShowGuestLinkDialog(true);

      toast({
        title: "Guest Link Generated",
        description: "Share this link with your patient via SMS"
      });
    } catch (error: any) {
      console.timeEnd(`[ProviderVirtualWaitingRoom] generate-guest-link-${sessionId}`);
      console.error('Error generating guest link:', error);
      
      if (error.message === 'timeout') {
        toast({
          title: "Still Processing",
          description: "Generating link... This may take a moment."
        });
        setTimeout(() => {
          queryClient.refetchQueries({ queryKey: ['provider-video-sessions', practiceId] });
        }, 2000);
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to generate guest link",
          variant: "destructive"
        });
      }
    } finally {
      setGeneratingLink(null);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    setCancellingSession(appointmentId);
    try {
      console.log('🔥 [UI] Cancelling appointment:', appointmentId);

      const { error } = await supabase.functions.invoke('cancel-appointment', {
        body: { appointmentId }
      });

      if (error) throw error;

      // Optimistically remove the session tied to this appointment from cache
      queryClient.setQueryData<any[]>(['provider-video-sessions', practiceId], (old) => {
        if (!old) return old;
        const next = old.filter((s) => s.appointment_id !== appointmentId);
        console.log('🧹 [UI] Optimistically removed session(s) for appointment', appointmentId, { before: old.length, after: next.length });
        return next;
      });

      // Wait briefly until backend marks the related video session as ended to avoid flicker
      const waitForVideoSessionEnd = async () => {
        for (let i = 0; i < 10; i++) { // ~2s max
          const { data } = await supabase
            .from('video_sessions')
            .select('id, status')
            .eq('appointment_id', appointmentId)
            .maybeSingle();
          if (!data || data.status === 'ended') return true;
          await new Promise((r) => setTimeout(r, 200));
        }
        return false;
      };

      const confirmed = await waitForVideoSessionEnd();
      console.log('⏱️ [UI] Backend confirmation that session ended:', confirmed);

      console.log('✅ [UI] Appointment cancelled, invalidating and refetching queries');

      // Force immediate refetch of the sessions list
      await queryClient.invalidateQueries({ 
        queryKey: ['provider-video-sessions', practiceId],
        refetchType: 'active'
      });
      await queryClient.refetchQueries({ queryKey: ['provider-video-sessions', practiceId] });

      toast({
        title: "✓ Appointment Cancelled",
        description: "The video appointment has been successfully cancelled"
      });

      console.log('✅ [UI] Queries refreshed, appointment should be removed from list');
    } catch (error: any) {
      console.error('❌ [UI] Error cancelling appointment:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to cancel appointment",
        variant: "destructive"
      });
    } finally {
      setCancellingSession(null);
      setShowCancelDialog(false);
      setSessionToCancel(null);
    }
  };

  const handleCompleteAppointment = async (appointmentId: string) => {
    setCompletingAppointment(appointmentId);
    try {
      console.log('🎉 [UI] Completing appointment:', appointmentId);

      const { error } = await supabase.functions.invoke('complete-video-appointment', {
        body: { appointmentId }
      });

      if (error) {
        console.error('❌ [UI] Complete appointment error:', error);
        let errorDescription = "Failed to complete appointment";
        
        // Parse error response for better messaging
        if (typeof error === 'object' && error !== null) {
          const errorObj = error as any;
          if (errorObj.message) {
            errorDescription = errorObj.message;
          } else if (errorObj.error) {
            errorDescription = errorObj.error;
          }
        }
        
        toast({
          title: "Completion Failed",
          description: errorDescription,
          variant: "destructive"
        });
        return;
      }

      // Optimistically remove the completed appointment from cache
      queryClient.setQueryData<any[]>(['provider-video-sessions', practiceId], (old) => {
        if (!old) return old;
        const next = old.filter((s) => s.appointment_id !== appointmentId);
        console.log('🧹 [UI] Optimistically removed completed appointment', appointmentId, { before: old.length, after: next.length });
        return next;
      });

      // Wait briefly for backend confirmation
      const waitForCompletion = async () => {
        for (let i = 0; i < 10; i++) {
          const { data } = await supabase
            .from('patient_appointments')
            .select('id, status')
            .eq('id', appointmentId)
            .maybeSingle();
          if (!data || data.status === 'completed') return true;
          await new Promise((r) => setTimeout(r, 200));
        }
        return false;
      };

      const confirmed = await waitForCompletion();
      console.log('⏱️ [UI] Backend confirmation that appointment completed:', confirmed);

      console.log('✅ [UI] Appointment completed, invalidating and refetching queries');

      // Force immediate refetch
      await queryClient.invalidateQueries({ 
        queryKey: ['provider-video-sessions', practiceId],
        refetchType: 'active'
      });
      await queryClient.refetchQueries({ queryKey: ['provider-video-sessions', practiceId] });

      toast({
        title: "✓ Appointment Completed",
        description: "The video appointment has been marked as completed"
      });

      console.log('✅ [UI] Queries refreshed, appointment should be removed from list');
    } catch (error: any) {
      console.error('❌ [UI] Error completing appointment:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to complete appointment",
        variant: "destructive"
      });
    } finally {
      setCompletingAppointment(null);
      setShowCompleteDialog(false);
      setAppointmentToComplete(null);
    }
  };


  const handleCreateInstantSession = async () => {
    if (!selectedPatientId || !selectedProviderId) {
      toast({
        title: "Error",
        description: "Please select both a patient and provider",
        variant: "destructive"
      });
      return;
    }

    setCreatingSession(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-instant-video-session', {
        body: {
          patientId: selectedPatientId,
          providerId: selectedProviderId,
          practiceId
        }
      });

      if (error) {
        console.error('Error creating instant session:', error);
        let errorDescription = "Failed to create instant session";
        
        // Parse error response for better messaging
        if (typeof error === 'object' && error !== null) {
          const errorObj = error as any;
          if (errorObj.message) {
            errorDescription = errorObj.message;
          } else if (errorObj.error) {
            errorDescription = errorObj.error;
          }
        }
        
        toast({
          title: "Creation Failed",
          description: errorDescription,
          variant: "destructive"
        });
        return;
      }

      // Start the session so patient gets notified immediately
      const { error: startError } = await supabase.functions.invoke('start-video-session', {
        body: { sessionId: (data as any).sessionId }
      });
      
      if (startError) {
        console.error('Error starting session:', startError);
        let errorDescription = "Failed to start the video session";
        
        // Parse error response for better messaging
        if (typeof startError === 'object' && startError !== null) {
          const errorObj = startError as any;
          if (errorObj.message) {
            errorDescription = errorObj.message;
          } else if (errorObj.error) {
            errorDescription = errorObj.error;
          }
        }
        
        toast({
          title: "Start Failed",
          description: errorDescription,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Session Started",
        description: "Instant video session started and patient notified"
      });

      // Refresh the sessions list with immediate refetch
      await queryClient.invalidateQueries({ queryKey: ['provider-video-sessions', practiceId] });
      await queryClient.refetchQueries({ queryKey: ['provider-video-sessions', practiceId] });

      // Navigate to the video room
      navigate(`/practice/video/${(data as any).sessionId}`);

      // Close dialog and reset
      setShowCreateDialog(false);
      setSelectedPatientId("");
      setSelectedProviderId("");
    } catch (error: any) {
      console.error('Error creating instant session:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create instant video session",
        variant: "destructive"
      });
    } finally {
      setCreatingSession(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (!videoSessions || videoSessions.length === 0) {
    return (
      <>
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5 text-primary" />
                Virtual Waiting Room
              </CardTitle>

              <div className="flex flex-col gap-2 relative z-10">
                <Button 
                  onClick={() => setShowScheduleDialog(true)}
                  variant="secondary"
                  className="gap-2 w-full cursor-pointer"
                >
                  <Calendar className="h-4 w-4" />
                  Schedule Video Appointment
                </Button>
                
                <Button 
                  onClick={() => setShowCreateDialog(true)}
                  className="gap-2 w-full cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Create Session with Patient
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Video className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No video appointments scheduled for today</p>
            </div>
          </CardContent>
        </Card>

        {/* Instant Session Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Instant Video Session</DialogTitle>
              <DialogDescription>
                Start an immediate video consultation with a patient
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Select Patient *</Label>
                <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {patientsLoading ? (
                      <SelectItem value="loading" disabled>
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Loading patients...
                        </div>
                      </SelectItem>
                    ) : patientsError ? (
                      <SelectItem value="error" disabled>
                        Failed to load patients. Try again.
                      </SelectItem>
                    ) : patients && patients.length > 0 ? (
                      patients.map((patient: any) => (
                        <SelectItem key={patient.id} value={patient.id}>
                          {getPatientDisplay(patient)}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-patients-available" disabled>
                        No patients found - please add patients first
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Select Provider *</Label>
                <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {!selectedPatientId ? (
                      <SelectItem value="no-patient-selected" disabled>
                        Please select a patient first
                      </SelectItem>
                    ) : filteredProviders && filteredProviders.length > 0 ? (
                      filteredProviders.map((provider: any) => {
                        const displayName = getProviderDisplayName(provider);
                        return (
                          <SelectItem key={provider.id} value={provider.id}>
                            <div className="flex items-center justify-between w-full gap-2">
                              <span>{displayName}</span>
                              {provider.type && (
                                <Badge 
                                  variant={provider.type === 'provider' ? 'default' : 'secondary'}
                                  className="ml-2 text-[10px] px-1.5 py-0"
                                >
                                  {provider.type === 'provider' ? 'Provider' : 'Staff'}
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })
                    ) : (
                      <SelectItem value="no-providers-available" disabled>
                        No providers assigned to this patient
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  setSelectedPatientId("");
                  setSelectedProviderId("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateInstantSession}
                disabled={!selectedPatientId || !selectedProviderId || creatingSession}
                className="gap-2"
              >
                {creatingSession ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Video className="h-4 w-4" />
                    Start Session
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Schedule Video Appointment Dialog */}
        <CreateAppointmentDialog
          open={showScheduleDialog}
          onOpenChange={setShowScheduleDialog}
          practiceId={practiceId}
          providers={allProviders?.map(p => ({
            id: p.id,
            full_name: p.full_name || getProviderDisplayName(p),
            first_name: p.first_name || '',
            last_name: p.last_name || '',
            type: p.type,
          })) || []}
          rooms={[]}
          defaultVisitType="video"
        />
      </>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Virtual Waiting Room
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {videoSessions.length} {videoSessions.length === 1 ? 'appointment' : 'appointments'}
            </span>
          </CardTitle>

              <div className="flex flex-col gap-2">
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                  <DialogTrigger asChild>
                    <Button className="gap-2 w-full">
                      <Plus className="h-4 w-4" />
                      Create Session with Patient
                    </Button>
                  </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Instant Video Session</DialogTitle>
                <DialogDescription>
                  Start an immediate video consultation with a patient
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Select Patient *</Label>
                  <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select patient" />
                    </SelectTrigger>
                    <SelectContent>
                      {patientsLoading ? (
                        <SelectItem value="loading" disabled>
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Loading patients...
                          </div>
                        </SelectItem>
                      ) : patientsError ? (
                        <SelectItem value="error" disabled>
                          Failed to load patients. Try again.
                        </SelectItem>
                      ) : patients && patients.length > 0 ? (
                        patients.map((patient: any) => (
                          <SelectItem key={patient.id} value={patient.id}>
                            {getPatientDisplay(patient)}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-patients-available" disabled>
                          No patients found - please add patients first
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Select Provider *</Label>
                  <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {!selectedPatientId ? (
                        <SelectItem value="no-patient-selected" disabled>
                          Please select a patient first
                        </SelectItem>
                      ) : filteredProviders && filteredProviders.length > 0 ? (
                        filteredProviders.map((provider: any) => {
                          const displayName = getProviderDisplayName(provider);
                          return (
                            <SelectItem key={provider.id} value={provider.id}>
                              <div className="flex items-center justify-between w-full gap-2">
                                <span>{displayName}</span>
                                {provider.type && (
                                  <Badge
                                    variant={provider.type === 'provider' ? 'default' : 'secondary'}
                                    className="ml-2 text-[10px] px-1.5 py-0"
                                  >
                                    {provider.type === 'provider' ? 'Provider' : 'Staff'}
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })
                      ) : (
                        <SelectItem value="no-providers-available" disabled>
                          No providers or staff found
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateDialog(false);
                    setSelectedPatientId("");
                    setSelectedProviderId("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateInstantSession}
                  disabled={!selectedPatientId || !selectedProviderId || creatingSession}
                  className="gap-2"
                >
                  {creatingSession ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Video className="h-4 w-4" />
                      Start Session
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

                <Button 
                  onClick={() => setShowScheduleDialog(true)}
                  variant="secondary"
                  className="gap-2 w-full"
                >
                  <Calendar className="h-4 w-4" />
                  Schedule Video Appointment
                </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {videoSessions.map((session) => {
          const patientAccount = Array.isArray(session.patient_accounts) 
            ? session.patient_accounts[0] 
            : session.patient_accounts;
          const fullName = patientAccount 
            ? `${patientAccount.first_name || ''} ${patientAccount.last_name || ''}`.trim() 
            : '';
          const patientName = patientAccount 
            ? (patientAccount.name || fullName || 'Patient')
            : 'Patient';
          
          const appointmentTime = format(
            new Date(session.scheduled_start_time),
            'h:mm a'
          );

          const isPatientWaiting = session.patient_joined_at !== null && session.provider_joined_at === null;

          return (
            <div
              key={session.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  {isPatientWaiting && (
                    <Circle className="h-3 w-3 fill-green-500 text-green-500 absolute -top-1 -right-1 animate-pulse" />
                  )}
                </div>
                
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {patientName}
                    {isSyntheticSession(session.id) && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        Initializing...
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    {appointmentTime}
                    <AppointmentCountdown scheduledStartTime={session.scheduled_start_time} />
                    {isPatientWaiting && (
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        • Patient waiting
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <VideoSessionStatus status={session.status as any} />
                
                {/* Prepare Session Now button - only for synthetic sessions 10+ min before start */}
                {isSyntheticSession(session.id) && 
                 differenceInMinutes(new Date(session.scheduled_start_time), new Date()) >= 10 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePrepareSession(session.id)}
                          disabled={preparingSession === session.id}
                          className="gap-2 border-primary/50 text-primary hover:bg-primary/10"
                        >
                          {preparingSession === session.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Video className="h-3 w-3" />
                          )}
                          Prepare Now
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Create session early to enable guest links and ready the room</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateGuestLink(session.id)}
                  disabled={generatingLink === session.id}
                  className="gap-2"
                  title="Generate guest access link"
                >
                  {generatingLink === session.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Link2 className="h-3 w-3" />
                  )}
                  Guest Link
                </Button>

                {session.status === 'scheduled' && (
                  <>
                    <Button
                      onClick={() => handleStartSession(session.id)}
                      size="sm"
                      className="gap-2"
                      disabled={startingSession === session.id}
                      title="Start the video session"
                    >
                      {startingSession === session.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Video className="h-4 w-4" />
                      )}
                      Start Session
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSessionToCancel(session.appointment_id);
                        setShowCancelDialog(true);
                      }}
                      disabled={cancellingSession === session.appointment_id}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Cancel appointment"
                    >
                      {cancellingSession === session.appointment_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  </>
                )}

                {session.status === 'waiting' && (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      className="gap-2 animate-pulse"
                      onClick={() => handleJoinSession(session.id)}
                    >
                      <Video className="h-4 w-4" />
                      Join Now
                    </Button>
                    {!isSyntheticSession(session.id) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
                        onClick={() => {
                          setAppointmentToComplete(session.appointment_id);
                          setShowCompleteDialog(true);
                        }}
                        disabled={completingAppointment === session.appointment_id}
                        title="Mark appointment as completed"
                      >
                        {completingAppointment === session.appointment_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        Complete
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSessionToCancel(session.appointment_id);
                        setShowCancelDialog(true);
                      }}
                      disabled={cancellingSession === session.appointment_id}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Cancel appointment"
                    >
                      {cancellingSession === session.appointment_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  </>
                )}

                {session.status === 'active' && !isSyntheticSession(session.id) && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
                      onClick={() => {
                        setAppointmentToComplete(session.appointment_id);
                        setShowCompleteDialog(true);
                      }}
                      disabled={completingAppointment === session.appointment_id}
                      title="Mark appointment as completed"
                    >
                      {completingAppointment === session.appointment_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Complete
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="gap-2"
                      onClick={() => handleJoinSession(session.id)}
                    >
                      <Video className="h-4 w-4" />
                      Rejoin
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSessionToCancel(session.appointment_id);
                        setShowCancelDialog(true);
                      }}
                      disabled={cancellingSession === session.appointment_id}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Cancel appointment"
                    >
                      {cancellingSession === session.appointment_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>

      {/* Schedule Video Appointment Dialog */}
      <CreateAppointmentDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        practiceId={practiceId}
        providers={allProviders?.map(p => ({
          id: p.id,
          display_name: getProviderDisplayName(p),
          full_name: getProviderDisplayName(p),
          first_name: p.first_name || '',
          last_name: p.last_name || '',
        })) || []}
        rooms={[]}
        defaultVisitType="video"
      />

      {/* Guest Link Dialog */}
      {guestLinkData && (
        <VideoGuestLinkDialog
          open={showGuestLinkDialog}
          onOpenChange={setShowGuestLinkDialog}
          guestUrl={guestLinkData.url}
          expiresAt={guestLinkData.expiresAt}
        />
      )}

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this video appointment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Appointment</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => sessionToCancel && handleCancelAppointment(sessionToCancel)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel Appointment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete Confirmation Dialog */}
      <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              Mark this video appointment as completed? The appointment will be removed from your waiting room and archived.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not Yet</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => appointmentToComplete && handleCompleteAppointment(appointmentToComplete)}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              Complete Appointment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
