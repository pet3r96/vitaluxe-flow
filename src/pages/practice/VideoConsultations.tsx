import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ProviderVirtualWaitingRoom } from "@/components/video/ProviderVirtualWaitingRoom";
import { RecordedSessionsList } from "@/components/video/RecordedSessionsList";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Video, Clock, FileVideo } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const VideoConsultations = () => {
  const { effectivePracticeId } = useAuth();
  const practiceId = effectivePracticeId || "";
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'upcoming';

  const { data: stats } = useQuery({
    queryKey: ['video-stats', practiceId],
    queryFn: async () => {
      const [activeCount, upcomingCount, recordingsCount] = await Promise.all([
        supabase
          .from('video_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('practice_id', practiceId)
          .eq('status', 'active'),
        supabase
          .from('video_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('practice_id', practiceId)
          .in('status', ['scheduled', 'waiting']),
        supabase
          .from('video_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('practice_id', practiceId)
          .not('recording_url', 'is', null)
          .gt('recording_expires_at', new Date().toISOString())
      ]);

      return {
        active: activeCount.count || 0,
        upcoming: upcomingCount.count || 0,
        recordings: recordingsCount.count || 0
      };
    },
    enabled: !!practiceId
  });

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Video Consultations</h1>
        <p className="text-muted-foreground mt-2">
          Manage your video appointments, start sessions, and view recordings.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-500/10 p-3">
                <Video className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Now</p>
                <p className="text-2xl font-bold">{stats?.active || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-500/10 p-3">
                <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Upcoming</p>
                <p className="text-2xl font-bold">{stats?.upcoming || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-purple-500/10 p-3">
                <FileVideo className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Recordings</p>
                <p className="text-2xl font-bold">{stats?.recordings || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming Sessions</TabsTrigger>
          <TabsTrigger value="recordings">Recorded Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-6">
          <ProviderVirtualWaitingRoom practiceId={practiceId} />
        </TabsContent>

        <TabsContent value="recordings" className="mt-6">
          <RecordedSessionsList practiceId={practiceId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VideoConsultations;
