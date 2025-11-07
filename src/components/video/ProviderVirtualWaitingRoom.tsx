import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, User, Clock, Circle } from "lucide-react";
import { format, isToday } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { VideoSessionStatus } from "./VideoSessionStatus";
import { useNavigate } from "react-router-dom";

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

  const { data: videoSessions, isLoading } = useQuery({
    queryKey: ['provider-video-sessions', practiceId],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, error } = await supabase
        .from('video_sessions')
        .select('*')
        .eq('practice_id', practiceId)
        .gte('scheduled_start_time', today.toISOString())
        .lt('scheduled_start_time', tomorrow.toISOString())
        .in('status', ['scheduled', 'waiting', 'active'])
        .order('scheduled_start_time', { ascending: true });

      if (error) throw error;
      return data;
    },
    refetchInterval: 5000 // Refresh every 5 seconds
  });

  const handleStartSession = async (sessionId: string) => {
    try {
      const { error } = await supabase.functions.invoke('start-video-session', {
        body: { sessionId }
      });

      if (error) throw error;

      toast({
        title: "Session Started",
        description: "Patient has been notified via SMS"
      });

      onStartSession?.(sessionId);
    } catch (error) {
      console.error('Error starting session:', error);
      toast({
        title: "Error",
        description: "Failed to start video session",
        variant: "destructive"
      });
    }
  };

  const handleJoinSession = (sessionId: string) => {
    navigate(`/practice/video/${sessionId}`);
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
            Virtual Waiting Room
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Video className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No video appointments scheduled for today</p>
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
          Virtual Waiting Room
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            {videoSessions.length} {videoSessions.length === 1 ? 'appointment' : 'appointments'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {videoSessions.map((session) => {
          const patientName = 'Patient';
          
          const appointmentTime = format(
            new Date(session.scheduled_start_time),
            'h:mm a'
          );

          const isPatientWaiting = session.patient_joined_at !== null;

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
                  <div className="font-medium">{patientName}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    {appointmentTime}
                    {isPatientWaiting && (
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        • Patient waiting
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <VideoSessionStatus status={session.status as any} />
                
                {session.status === 'scheduled' && (
                  <Button
                    onClick={() => handleStartSession(session.id)}
                    className="gap-2"
                  >
                    <Video className="h-4 w-4" />
                    Start Session
                  </Button>
                )}

                {session.status === 'waiting' && (
                  <Button
                    variant="default"
                    className="gap-2 animate-pulse"
                    onClick={() => handleJoinSession(session.id)}
                  >
                    <Video className="h-4 w-4" />
                    Join Now
                  </Button>
                )}

                {session.status === 'active' && (
                  <Button
                    variant="default"
                    className="gap-2"
                    onClick={() => handleJoinSession(session.id)}
                  >
                    <Video className="h-4 w-4" />
                    Rejoin
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
