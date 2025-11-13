import { Button } from "@/components/ui/button";
import { Video } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

interface JoinVideoButtonProps {
  videoSessionId: string;
  userType: "patient" | "provider";
  status: string;
  startTime: string;
}

export function JoinVideoButton({
  videoSessionId,
  userType,
  status,
  startTime
}: JoinVideoButtonProps) {
  const navigate = useNavigate();
  const [canJoin, setCanJoin] = useState(false);
  const [minutesUntil, setMinutesUntil] = useState<number>(0);

  useEffect(() => {
    const checkTime = () => {
      const appointmentTime = new Date(startTime);
      const now = new Date();
      const timeDiff = appointmentTime.getTime() - now.getTime();
      const minutes = Math.floor(timeDiff / 1000 / 60);
      
      setMinutesUntil(minutes);
      setCanJoin(minutes <= 15 && status !== 'completed' && status !== 'cancelled');
    };

    checkTime();
    const interval = setInterval(checkTime, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [startTime, status]);

  if (!canJoin) {
    return (
      <div className="text-sm text-muted-foreground">
        {minutesUntil > 15 
          ? `Available ${minutesUntil} minutes before appointment`
          : 'Session ended'
        }
      </div>
    );
  }

  const handleJoin = () => {
    const path = userType === "provider" 
      ? `/practice/video/${videoSessionId}`
      : `/patient/video/${videoSessionId}`;
    navigate(path);
  };

  return (
    <Button onClick={handleJoin} className="gap-2">
      <Video className="h-4 w-4" />
      Join Video Call
    </Button>
  );
}
