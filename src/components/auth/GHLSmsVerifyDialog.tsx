import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface GHLSmsVerifyDialogProps {
  open: boolean;
  phoneNumber: string;
  userId: string;
}

export const GHLSmsVerifyDialog = ({ open, phoneNumber, userId }: GHLSmsVerifyDialogProps) => {
  const { mark2FAVerified } = useAuth();
  const [code, setCode] = useState('');
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    if (open && !codeSent) {
      // Check sessionStorage for recent attempt
      const storageKey = `vitaluxe_2fa_attempt_${userId}`;
      const storedAttempt = sessionStorage.getItem(storageKey);
      
      if (storedAttempt) {
        try {
          const { attemptId: storedId, sentAt } = JSON.parse(storedAttempt);
          const minutesSinceSent = (Date.now() - new Date(sentAt).getTime()) / (1000 * 60);
          
          // If code was sent within 5 minutes, restore and don't send again
          if (minutesSinceSent < 5 && storedId) {
            console.log('[GHLSmsVerifyDialog] Restoring recent attempt from sessionStorage');
            setAttemptId(storedId);
            setCodeSent(true);
            const secondsRemaining = Math.floor((5 * 60) - (minutesSinceSent * 60));
            setCountdown(Math.max(0, Math.min(60, secondsRemaining)));
            return;
          }
        } catch (e) {
          console.error('[GHLSmsVerifyDialog] Failed to parse stored attempt:', e);
        }
      }
      
      // No valid stored attempt, send new code
      sendCode();
    }
  }, [open]);

  const maskPhone = (phoneNum: string) => {
    const cleaned = phoneNum.replace(/\D/g, '');
    if (cleaned.length >= 10) {
      return `+${cleaned.slice(0, 1)}-XXX-XXX-${cleaned.slice(-4)}`;
    }
    return phoneNum;
  };

  const sendCode = async () => {
    setLoading(true);
    setError('');

    try {
      // Validate phone number is present
      if (!phoneNumber || phoneNumber.trim().length === 0) {
        throw new Error('Phone number is required');
      }

      // Sanitize phone number to E.164 format
      const sanitizedPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
      if (!sanitizedPhone.startsWith('+')) {
        throw new Error('Phone number must include country code (e.g., +1)');
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const { data, error } = await supabase.functions.invoke('send-ghl-sms', {
        body: { phoneNumber: sanitizedPhone, purpose: 'verification' }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Store attemptId for verification
      if (data.attemptId) {
        setAttemptId(data.attemptId);
        
        // Persist to sessionStorage
        const storageKey = `vitaluxe_2fa_attempt_${userId}`;
        sessionStorage.setItem(storageKey, JSON.stringify({
          attemptId: data.attemptId,
          sentAt: new Date().toISOString()
        }));
        console.log('[GHLSmsVerifyDialog] Attempt stored in sessionStorage');
      } else {
        throw new Error('No attempt ID received from server');
      }

      toast.success('Verification code sent!');
      setCodeSent(true);
      setCountdown(60);
    } catch (err: any) {
      console.error('Error sending SMS:', err);
      setError(err.message || 'Failed to send verification code');
      toast.error(err.message || 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setCode('');
    setAttemptsRemaining(null);
    // Clear stored attempt to force fresh send
    const storageKey = `vitaluxe_2fa_attempt_${userId}`;
    sessionStorage.removeItem(storageKey);
    await sendCode();
  };

  const verifyCode = async () => {
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    if (!attemptId) {
      setError('Verification session expired. Please resend code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const { data, error } = await supabase.functions.invoke('verify-ghl-sms', {
        body: { code, attemptId, phoneNumber }, // Send attemptId, code, and phoneNumber
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      // Handle response - check for success first (friendly errors return 200)
      if (data?.success === false) {
        setAttemptsRemaining(data.attemptsRemaining ?? null);
        throw new Error(data.error || 'Verification failed');
      }

      if (error) throw error;

      // Success
      mark2FAVerified();
      
      toast.success('Verification successful!');
      // No reload needed - state change will automatically hide the dialog
    } catch (err: any) {
      console.error('Error verifying code:', err);
      setError(err.message || 'Invalid verification code');
      toast.error(err.message || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>🔒 SMS Verification Required</DialogTitle>
          <DialogDescription>
            Please verify your identity to continue.
            {codeSent && ` Code sent to ${maskPhone(phoneNumber)}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Enter 6-Digit Code</Label>
            <InputOTP
              maxLength={6}
              value={code}
              onChange={(value) => {
                setCode(value);
                setError('');
              }}
              disabled={loading}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          {attemptsRemaining !== null && (
            <p className="text-sm text-muted-foreground">
              {attemptsRemaining} {attemptsRemaining === 1 ? 'attempt' : 'attempts'} remaining
            </p>
          )}

          {error && (
            <Alert variant="destructive">
              {error}
            </Alert>
          )}

          <Button 
            onClick={verifyCode} 
            disabled={code.length !== 6 || loading}
            className="w-full"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Verifying...' : 'Verify Code'}
          </Button>

          <Button 
            variant="outline" 
            onClick={resendCode} 
            disabled={countdown > 0 || loading}
            className="w-full"
          >
            {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};