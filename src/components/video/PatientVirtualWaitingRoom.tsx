import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Video, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { format, differenceInMinutes, isBefore, addMinutes } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { VideoSessionStatus } from "./VideoSessionStatus";

interface PatientVirtualWaitingRoomProps {
  patientId: string;
  onJoinSession?: (sessionId: string) => void;
}

export const PatientVirtualWaitingRoom = ({
  patientId,
  onJoinSession
}: PatientVirtualWaitingRoomProps) => {
  const { toast } = useToast();
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  const { data: videoSessions, isLoading } = useQuery({
    queryKey: ['patient-video-sessions', patientId],
    queryFn: async () => {
      const now = new Date();
      
      const { data, error } = await supabase
        .from('video_sessions')
        .select('*')
        .eq('patient_id', patientId)
        .gte('scheduled_start_time', now.toISOString())
        .in('status', ['scheduled', 'waiting', 'active'])
        .order('scheduled_start_time', { ascending: true })
        .limit(5);

      if (error) throw error;
      return data;
    },
    refetchInterval: 5000
  });

  const getSessionAccessibility = (session: any) => {
    const now = new Date();
    const scheduledTime = new Date(session.scheduled_start_time);
    const earlyAccessTime = addMinutes(scheduledTime, -15);

    if (session.status === 'active' || session.status === 'waiting') {
      return {
        canJoin: true,
        status: 'provider_waiting',
        message: 'Provider is ready!'
      };
    }

    if (isBefore(now, earlyAccessTime)) {
      const minutesUntil = differenceInMinutes(earlyAccessTime, now);
      return {
        canJoin: false,
        status: 'too_early',
        message: `Available in ${minutesUntil} minutes`
      };
    }

    return {
      canJoin: true,
      status: 'ready',
      message: 'Ready to join'
    };
  };

  const handleJoinSession = async (sessionId: string) => {
    if (!recordingConsent) {
      toast({
        title: "Consent Required",
        description: "Please acknowledge the recording consent to join",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('join-video-session', {
        body: { sessionId }
      });

      if (error) throw error;

      onJoinSession?.(sessionId);
    } catch (error) {
      console.error('Error joining session:', error);
      toast({
        title: "Error",
        description: "Failed to join video session",
        variant: "destructive"
      });
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Video Appointments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Video className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No upcoming video appointments</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5 text-primary" />
          Video Appointments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {videoSessions.map((session) => {
          const providerName = 'Your Provider';
          
          const appointmentTime = format(
            new Date(session.scheduled_start_time),
            'MMM d, h:mm a'
          );

          const accessibility = getSessionAccessibility(session);

          return (
            <div
              key={session.id}
              className="p-4 border rounded-lg space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{providerName}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                    <Clock className="h-3 w-3" />
                    {appointmentTime}
                  </div>
                </div>
                <VideoSessionStatus status={session.status as any} />
              </div>

              {accessibility.status === 'provider_waiting' && (
                <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">{accessibility.message}</span>
                </div>
              )}

              {accessibility.status === 'too_early' && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{accessibility.message}</span>
                </div>
              )}

              {accessibility.status === 'ready' && (
                <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-700 dark:text-blue-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">{accessibility.message}</span>
                </div>
              )}

              {accessibility.canJoin && (
                <>
                  <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <Checkbox
                      id={`consent-${session.id}`}
                      checked={selectedSession === session.id && recordingConsent}
                      onCheckedChange={(checked) => {
                        setSelectedSession(session.id);
                        setRecordingConsent(checked as boolean);
                      }}
                      className="mt-0.5"
                    />
                    <label
                      htmlFor={`consent-${session.id}`}
                      className="text-sm text-amber-700 dark:text-amber-400 cursor-pointer"
                    >
                      I understand that this video consultation will be recorded for quality assurance and HIPAA compliance purposes.
                    </label>
                  </div>

                  <Button
                    className="w-full gap-2"
                    size="lg"
                    disabled={!recordingConsent || selectedSession !== session.id}
                    onClick={() => handleJoinSession(session.id)}
                  >
                    <Video className="h-5 w-5" />
                    Join Video Consultation
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
