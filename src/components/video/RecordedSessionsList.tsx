import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from "@/components/ui/pagination";
import { VideoRecordingViewer } from "./VideoRecordingViewer";
import { Video, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface RecordedSessionsListProps {
  practiceId: string;
}

export const RecordedSessionsList = ({ practiceId }: RecordedSessionsListProps) => {
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading } = useQuery({
    queryKey: ['recorded-sessions', practiceId, currentPage],
    queryFn: async () => {
      const start = (currentPage - 1) * pageSize;
      const end = start + pageSize - 1;

      // Get recordings with patient and provider details
      const { data: sessions, error, count } = await supabase
        .from('video_sessions')
        .select(`
          *,
          patient_accounts!video_sessions_patient_id_fkey(id, first_name, last_name),
          providers!video_sessions_provider_id_fkey(id, user_id)
        `, { count: 'exact' })
        .eq('practice_id', practiceId)
        .not('recording_url', 'is', null)
        .gt('recording_expires_at', new Date().toISOString())
        .order('recording_stopped_at', { ascending: false })
        .range(start, end);

      if (error) throw error;

      return { sessions: sessions || [], total: count || 0 };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false
  });

  const handleDownloadRecording = async (sessionId: string, recordingUrl: string) => {
    try {
      // Log download event
      await supabase.from('video_session_logs').insert({
        session_id: sessionId,
        event_type: 'recording_downloaded',
        user_id: (await supabase.auth.getUser()).data.user?.id,
        user_type: 'provider',
        event_data: { download_time: new Date().toISOString() }
      });

      // Open recording in new tab
      window.open(recordingUrl, '_blank');
      
      toast({
        title: "Download Started",
        description: "Recording opened in new tab"
      });
    } catch (error) {
      console.error('Error downloading recording:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download recording",
        variant: "destructive"
      });
    }
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-64" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data?.sessions?.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="rounded-full bg-primary/10 p-6 mb-4">
            <Video className="h-12 w-12 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No Recordings Yet</h3>
          <p className="text-muted-foreground text-center max-w-sm">
            Video recordings will appear here after sessions end. Recordings are kept for 30 days.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, data.total)} of {data.total} recordings
        </p>
      </div>

      <div className="space-y-6">
        {data.sessions.map(session => {
          const patient = session.patient_accounts;
          const provider = session.providers;
          const patientName = patient 
            ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Unknown Patient'
            : 'Unknown Patient';
          const providerName = 'Provider';
          
          const duration = session.recording_stopped_at && session.recording_started_at
            ? Math.floor((new Date(session.recording_stopped_at).getTime() - new Date(session.recording_started_at).getTime()) / 1000)
            : null;

          return (
            <Card key={session.id}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Video className="h-5 w-5 text-primary" />
                  {patientName} with {providerName}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {session.scheduled_start_time && format(new Date(session.scheduled_start_time), 'PPp')}
                </p>
              </CardHeader>
              <CardContent>
                <VideoRecordingViewer
                  recordingUrl={session.recording_url}
                  expiresAt={session.recording_expires_at}
                  duration={duration}
                  participants={{
                    provider: providerName,
                    patient: patientName
                  }}
                  onDownload={() => handleDownloadRecording(session.id, session.recording_url!)}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
            
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(page => (
              <PaginationItem key={page}>
                <PaginationLink
                  onClick={() => setCurrentPage(page)}
                  isActive={currentPage === page}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}
            
            {totalPages > 5 && (
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
            )}
            
            <PaginationItem>
              <PaginationNext
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
};