import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * PracticeVideoRoomLink
 * 
 * Universal practice room link handler at /practice/video/room/:roomKey
 * Resolves the roomKey to an active session or creates a new instant session
 * Then redirects to the provider video consultation room
 */
const PracticeVideoRoomLink = () => {
  const { roomKey } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const resolvePracticeRoom = async () => {
      if (!roomKey) {
        setError("Invalid practice room link");
        setLoading(false);
        return;
      }

      try {
        console.log('[PracticeVideoRoomLink] Resolving room key:', roomKey);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.log('[PracticeVideoRoomLink] Not authenticated, redirecting to auth');
          navigate('/auth');
          return;
        }

        const { data, error: fnError } = await supabase.functions.invoke(
          'resolve-practice-room-join',
          {
            body: { roomKey },
          }
        );

        if (fnError) {
          console.error('[PracticeVideoRoomLink] Resolution error:', fnError);
          throw new Error(fnError.message || 'Failed to resolve practice room');
        }

        if (!data.success) {
          console.error('[PracticeVideoRoomLink] Resolution failed:', data.error);
          
          if (data.error === 'invalid_room_key') {
            setError('This practice room link is invalid. Please check the URL.');
          } else if (data.error === 'not_authorized') {
            setError('You do not have access to this practice room.');
          } else {
            setError(data.message || 'Unable to join practice room');
          }
          setLoading(false);
          return;
        }

        console.log('[PracticeVideoRoomLink] Room resolved, redirecting to session:', data.sessionId);

        if (mounted) {
          // Redirect to the unified video room
          navigate('/video/room', { replace: true });
        }
      } catch (e: any) {
        console.error('[PracticeVideoRoomLink] Error:', e);
        if (mounted) {
          setError(e.message || 'Failed to resolve practice room');
          setLoading(false);
        }
      }
    };

    resolvePracticeRoom();

    return () => {
      mounted = false;
    };
  }, [roomKey, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Connecting to practice room...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
        <div className="text-destructive text-lg font-semibold">Unable to Join Practice Room</div>
        <p className="text-muted-foreground text-sm max-w-md text-center">{error}</p>
        <button
          onClick={() => navigate('/practice/dashboard')}
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return null;
};

export default PracticeVideoRoomLink;
