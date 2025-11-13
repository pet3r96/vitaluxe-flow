import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface VideoSessionEvent {
  id: string;
  session_id: string;
  event_type: string;
  user_uid: string;
  payload?: any;
  created_at: string;
}

export interface WaitingPatient {
  uid: string;
  name?: string;
  joinedAt: Date;
}

export interface UseVideoEventsParams {
  sessionId: string;
  userUid: string;
  enabled?: boolean;
}

export interface UseVideoEventsReturn {
  events: VideoSessionEvent[];
  isWaiting: boolean;
  isAdmitted: boolean;
  waitingPatients: WaitingPatient[];
  
  emitWaiting: () => Promise<void>;
  emitAdmitted: (patientUid: string) => Promise<void>;
  emitJoined: () => Promise<void>;
  emitLeft: () => Promise<void>;
  
  clearWaitingPatient: (uid: string) => void;
}

export const useVideoEvents = ({ 
  sessionId, 
  userUid, 
  enabled = true 
}: UseVideoEventsParams): UseVideoEventsReturn => {
  const [events, setEvents] = useState<VideoSessionEvent[]>([]);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isAdmitted, setIsAdmitted] = useState(false);
  const [waitingPatients, setWaitingPatients] = useState<WaitingPatient[]>([]);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  // Subscribe to video session events
  useEffect(() => {
    if (!enabled || !sessionId) return;

    console.log('[useVideoEvents] Setting up realtime subscription for session:', sessionId);

    const channelName = `video-session-${sessionId}`;
    const realtimeChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'video_session_events',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          console.log('[useVideoEvents] New event received:', payload);
          const newEvent = payload.new as VideoSessionEvent;
          
          setEvents(prev => [...prev, newEvent]);

          // Handle different event types
          switch (newEvent.event_type) {
            case 'patient_waiting':
              // Add to waiting list if not already there
              if (newEvent.user_uid !== userUid) {
                setWaitingPatients(prev => {
                  if (prev.find(p => p.uid === newEvent.user_uid)) return prev;
                  return [...prev, {
                    uid: newEvent.user_uid,
                    name: newEvent.payload?.name,
                    joinedAt: new Date(newEvent.created_at),
                  }];
                });
              }
              break;

            case 'patient_admitted':
              // If this user was admitted
              if (newEvent.user_uid === userUid) {
                console.log('[useVideoEvents] Current user admitted');
                setIsAdmitted(true);
                setIsWaiting(false);
              }
              // Remove from waiting list
              setWaitingPatients(prev => 
                prev.filter(p => p.uid !== newEvent.user_uid)
              );
              break;

            case 'joined':
              console.log('[useVideoEvents] User joined:', newEvent.user_uid);
              break;

            case 'left':
              console.log('[useVideoEvents] User left:', newEvent.user_uid);
              // Remove from waiting list if applicable
              setWaitingPatients(prev => 
                prev.filter(p => p.uid !== newEvent.user_uid)
              );
              break;
          }
        }
      )
      .subscribe();

    setChannel(realtimeChannel);

    return () => {
      console.log('[useVideoEvents] Cleaning up realtime subscription');
      realtimeChannel.unsubscribe();
    };
  }, [enabled, sessionId, userUid]);

  // Emit patient_waiting event
  const emitWaiting = useCallback(async () => {
    try {
      console.log('[useVideoEvents] Emitting patient_waiting event');
      const { error } = await supabase
        .from('video_session_events')
        .insert({
          session_id: sessionId,
          event_type: 'patient_waiting',
          user_uid: userUid,
        });

      if (error) throw error;

      setIsWaiting(true);
      console.log('[useVideoEvents] Patient waiting event emitted');
    } catch (error) {
      console.error('[useVideoEvents] Error emitting waiting event:', error);
      throw error;
    }
  }, [sessionId, userUid]);

  // Emit patient_admitted event
  const emitAdmitted = useCallback(async (patientUid: string) => {
    try {
      console.log('[useVideoEvents] Emitting patient_admitted event for:', patientUid);
      const { error } = await supabase
        .from('video_session_events')
        .insert({
          session_id: sessionId,
          event_type: 'patient_admitted',
          user_uid: patientUid,
        });

      if (error) throw error;

      console.log('[useVideoEvents] Patient admitted event emitted');
    } catch (error) {
      console.error('[useVideoEvents] Error emitting admitted event:', error);
      throw error;
    }
  }, [sessionId]);

  // Emit joined event
  const emitJoined = useCallback(async () => {
    try {
      console.log('[useVideoEvents] Emitting joined event');
      const { error } = await supabase
        .from('video_session_events')
        .insert({
          session_id: sessionId,
          event_type: 'joined',
          user_uid: userUid,
        });

      if (error) throw error;

      console.log('[useVideoEvents] Joined event emitted');
    } catch (error) {
      console.error('[useVideoEvents] Error emitting joined event:', error);
      throw error;
    }
  }, [sessionId, userUid]);

  // Emit left event
  const emitLeft = useCallback(async () => {
    try {
      console.log('[useVideoEvents] Emitting left event');
      const { error } = await supabase
        .from('video_session_events')
        .insert({
          session_id: sessionId,
          event_type: 'left',
          user_uid: userUid,
        });

      if (error) throw error;

      console.log('[useVideoEvents] Left event emitted');
    } catch (error) {
      console.error('[useVideoEvents] Error emitting left event:', error);
      // Don't throw - leaving should always succeed
    }
  }, [sessionId, userUid]);

  // Clear a waiting patient manually (e.g., if they disconnect)
  const clearWaitingPatient = useCallback((uid: string) => {
    setWaitingPatients(prev => prev.filter(p => p.uid !== uid));
  }, []);

  return {
    events,
    isWaiting,
    isAdmitted,
    waitingPatients,
    emitWaiting,
    emitAdmitted,
    emitJoined,
    emitLeft,
    clearWaitingPatient,
  };
};
