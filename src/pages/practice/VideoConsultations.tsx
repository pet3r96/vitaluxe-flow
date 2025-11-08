import { ProviderVirtualWaitingRoom } from "@/components/video/ProviderVirtualWaitingRoom";
import { VideoSystemHealth } from "@/components/debug/VideoSystemHealth";
import { useAuth } from "@/contexts/AuthContext";

const VideoConsultations = () => {
  const { effectivePracticeId } = useAuth();
  const practiceId = effectivePracticeId || "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Video Consultations</h1>
        <p className="text-muted-foreground mt-2">
          Manage your video appointments, start sessions, and create instant consultations with patients.
        </p>
      </div>
      
      <VideoSystemHealth practiceId={practiceId} />
      
      <ProviderVirtualWaitingRoom practiceId={practiceId} />
    </div>
  );
};

export default VideoConsultations;
