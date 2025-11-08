import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AgoraVideoRoom } from "@/components/video/AgoraVideoRoom";
import { Card } from "@/components/ui/card";
import { Loader2, AlertCircle, Clock, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function VideoGuestJoin() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState<any>(null);
  const [error, setError] = useState<{
    type: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    const validateAndJoin = async () => {
      if (!token) {
        setError({
          type: 'invalid',
          message: 'No access token provided',
        });
        setLoading(false);
        return;
      }

      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 12000)
        );

        const invokePromise = supabase.functions.invoke(
          'validate-video-guest-link',
          {
            body: { token },
          }
        );

        const { data, error: validateError } = await Promise.race([invokePromise, timeoutPromise]) as any;

        if (validateError) throw validateError;

        if (data.error) {
          setError({
            type: data.error,
            message: data.message,
          });
        } else {
          setSessionData(data.sessionData);
        }
      } catch (err: any) {
        console.error('Error validating guest link:', err);
        setError({
          type: err.message === 'timeout' ? 'timeout' : 'error',
          message: err.message === 'timeout' ? 'Validation is taking longer than expected. Please try again.' : (err.message || 'Failed to validate access link'),
        });
      } finally {
        setLoading(false);
      }
    };

    validateAndJoin();
  }, [token]);

  const handleLeave = () => {
    navigate('/');
  };

  const getErrorIcon = () => {
    switch (error?.type) {
      case 'expired':
        return <Clock className="h-12 w-12 text-amber-500" />;
      case 'already_used':
        return <CheckCircle className="h-12 w-12 text-blue-500" />;
      default:
        return <AlertCircle className="h-12 w-12 text-destructive" />;
    }
  };

  const getErrorTitle = () => {
    switch (error?.type) {
      case 'expired':
        return 'Link Expired';
      case 'already_used':
        return 'Link Already Used';
      case 'invalid_token':
        return 'Invalid Link';
      case 'session_not_ready':
        return 'Session Not Ready';
      default:
        return 'Access Error';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Validating Access</h2>
              <p className="text-muted-foreground">
                Please wait while we verify your guest link...
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (error || !sessionData) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            {getErrorIcon()}
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold">{getErrorTitle()}</h2>
              <p className="text-muted-foreground">
                {error?.message || 'Unable to access video session'}
              </p>
            </div>

            {error?.type === 'expired' && (
              <Alert>
                <AlertDescription>
                  This guest link has expired. Please contact your healthcare
                  provider for a new link.
                </AlertDescription>
              </Alert>
            )}

            {error?.type === 'already_used' && (
              <Alert>
                <AlertDescription>
                  This one-time guest link has already been used. If you need to
                  rejoin, please contact your healthcare provider.
                </AlertDescription>
              </Alert>
            )}

            <Button onClick={() => navigate('/')} className="w-full">
              Return Home
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute top-4 left-4 z-10">
        <Card className="px-3 py-2 bg-amber-500/10 border-amber-500/20">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
            Guest Access
          </p>
        </Card>
      </div>
      <AgoraVideoRoom
        channelName={sessionData.channelName}
        token={sessionData.token}
        uid={sessionData.uid}
        appId={sessionData.appId}
        onLeave={handleLeave}
        isProvider={false}
        sessionId={sessionData.sessionId}
        userName="Guest"
      />
    </div>
  );
}
