import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authService } from "@/lib/authService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const verifyToken = async () => {
      const token = searchParams.get('token');

      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link. Please check your email and try again.');
        return;
      }

      const { error, message: successMessage } = await authService.verifyEmail(token);

      if (error) {
        setStatus('error');
        setMessage(error.message || 'Verification failed. Please try again.');
      } else {
        setStatus('success');
        setMessage(successMessage || 'Your email has been verified successfully!');
      }
    };

    verifyToken();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md shadow-glow">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {status === 'loading' && (
              <Loader2 className="h-16 w-16 text-primary animate-spin" />
            )}
            {status === 'success' && (
              <CheckCircle2 className="h-16 w-16 text-success" />
            )}
            {status === 'error' && (
              <XCircle className="h-16 w-16 text-destructive" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {status === 'loading' && 'Verifying Your Email...'}
            {status === 'success' && 'Email Verified!'}
            {status === 'error' && 'Verification Failed'}
          </CardTitle>
          <CardDescription className="mt-2">
            {status === 'loading' && 'Please wait while we verify your email address.'}
            {status === 'success' && message}
            {status === 'error' && message}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'success' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">
                You can now log in to your account using your email and password.
              </p>
              <Button
                onClick={() => navigate('/auth')}
                className="w-full"
                size="lg"
              >
                Go to Login
              </Button>
            </div>
          )}
          {status === 'error' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">
                If you continue to experience issues, please contact support at{' '}
                <a href="mailto:support@vitaluxeservices.com" className="text-primary hover:underline">
                  support@vitaluxeservices.com
                </a>
              </p>
              <Button
                onClick={() => navigate('/auth')}
                variant="outline"
                className="w-full"
              >
                Back to Login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
