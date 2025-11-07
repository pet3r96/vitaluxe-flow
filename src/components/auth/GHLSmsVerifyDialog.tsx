import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// Cross-tab lock utilities
const LOCK_KEY = (userId: string) => `twofa_sms_lock_${userId}`;
const COOLDOWN_KEY = (userId: string) => `twofa_sms_cooldown_until_${userId}`;
const LOCK_TTL = 45000; // 45 seconds

interface LockData {
  createdAt: number;
  phoneHash: string;
}

interface GHLSmsVerifyDialogProps {
  open: boolean;
  phoneNumber: string;
  userId: string;
}

export const GHLSmsVerifyDialog = ({ open, phoneNumber, userId }: GHLSmsVerifyDialogProps) => {
  const { mark2FAVerified } = useAuth();
  const sentRef = useRef(false);
  const [code, setCode] = useState('');
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [isQueued, setIsQueued] = useState(false);
  
  // Check and sync shared cooldown across tabs
  const checkSharedCooldown = useCallback(() => {
    const cooldownUntil = localStorage.getItem(COOLDOWN_KEY(userId));
    if (cooldownUntil) {
      const remaining = Math.ceil((parseInt(cooldownUntil) - Date.now()) / 1000);
      if (remaining > 0) {
        setCountdown(remaining);
        return true;
      } else {
        localStorage.removeItem(COOLDOWN_KEY(userId));
      }
    }
    return false;
  }, [userId]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      // Clear lock when countdown expires
      localStorage.removeItem(LOCK_KEY(userId));
    }
  }, [countdown, userId]);

  // Listen to storage events from other tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === COOLDOWN_KEY(userId)) {
        checkSharedCooldown();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [userId, checkSharedCooldown]);



  // Initial code send with cross-tab lock
  useEffect(() => {
    if (open && userId && !sentRef.current) {
      // Check for existing cooldown from another tab
      const hasCooldown = checkSharedCooldown();
      if (hasCooldown) {
        console.log('[GHLSmsVerifyDialog] Active cooldown found, skipping auto-send');
        setCodeSent(true);
        return;
      }
      
      sentRef.current = true;
      console.log('[GHLSmsVerifyDialog] Dialog opened - sending fresh code');
      void sendCode();
    }
    
    // Reset ref when dialog closes
    if (!open) {
      sentRef.current = false;
    }
  }, [open, userId, checkSharedCooldown]);

  const maskPhone = (phoneNum: string) => {
    const cleaned = phoneNum.replace(/\D/g, '');
    if (cleaned.length >= 10) {
      return `+${cleaned.slice(0, 1)}-XXX-XXX-${cleaned.slice(-4)}`;
    }
    return phoneNum;
  };


  const handleReturnToLogin = async () => {
    console.log('[GHLSmsVerifyDialog] User clicked Return to Login', { userId });
    await supabase.auth.signOut();
    window.location.href = '/auth';
  };

  const sendCode = async () => {
    console.log('[GHLSmsVerifyDialog] sendCode START', { phoneNumber, userId });
    
    // Check cross-tab lock
    const lockData = localStorage.getItem(LOCK_KEY(userId));
    if (lockData) {
      try {
        const lock: LockData = JSON.parse(lockData);
        const lockAge = Date.now() - lock.createdAt;
        if (lockAge < LOCK_TTL) {
          const remainingMs = LOCK_TTL - lockAge;
          console.log('[GHLSmsVerifyDialog] Send blocked by cross-tab lock', { remainingMs });
          setCountdown(Math.ceil(remainingMs / 1000));
          toast.info('Code send in progress from another tab');
          return;
        }
      } catch (e) {
        // Invalid lock data, clear it
        localStorage.removeItem(LOCK_KEY(userId));
      }
    }

    // Set lock immediately
    const phoneHash = phoneNumber.slice(-4);
    localStorage.setItem(LOCK_KEY(userId), JSON.stringify({
      createdAt: Date.now(),
      phoneHash
    }));

    setLoading(true);
    setError('');
    setAttemptsRemaining(null);
    setIsQueued(false);

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
        body: { phoneNumber: sanitizedPhone, purpose: 'verification' },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Store attemptId for verification
      if (data.attemptId) {
        console.log('[GHLSmsVerifyDialog] SMS sent successfully - SETTING attemptId', { 
          attemptId: data.attemptId,
          phoneNumber: sanitizedPhone.substring(0, 5) + '***',
          queued: data.queued
        });
        setAttemptId(data.attemptId);
        setIsQueued(!!data.queued);
      } else {
        throw new Error('No attempt ID received from server');
      }

      // Set shared cooldown (30 seconds)
      const cooldownUntil = Date.now() + 30000;
      localStorage.setItem(COOLDOWN_KEY(userId), cooldownUntil.toString());
      setCountdown(30);

      toast.success(data.queued ? 'Code is being sent...' : 'Verification code sent!');
      setCodeSent(true);
      
    } catch (err: any) {
      console.error('Error sending SMS:', err);
      setError(err.message || 'Failed to send verification code');
      toast.error(err.message || 'Failed to send code');
      // Remove lock on error to allow retry
      localStorage.removeItem(LOCK_KEY(userId));
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setCode('');
    setAttemptsRemaining(null);
    await sendCode();
  };

  const verifyCode = async (codeValue?: string) => {
    const codeToVerify = codeValue || code;
    
    console.log('[GHLSmsVerifyDialog] verifyCode CALLED', {
      codeLength: codeToVerify.length,
      hasAttemptId: !!attemptId,
      attemptId: attemptId,
      hasPhoneNumber: !!phoneNumber,
      loading
    });
    
    if (loading) {
      console.log('[GHLSmsVerifyDialog] Blocked: already loading');
      return;
    }
    
    if (codeToVerify.length !== 6) {
      console.log('[GHLSmsVerifyDialog] Blocked: code length not 6');
      setError('Please enter the complete 6-digit code');
      return;
    }

    if (!attemptId) {
      console.log('[GHLSmsVerifyDialog] BLOCKED: No attemptId!', { 
        attemptIdState: attemptId,
        sentRefCurrent: sentRef.current 
      });
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
        body: { code: codeToVerify, attemptId, phoneNumber }, // Send attemptId, code, and phoneNumber
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
            {codeSent && (
              <>
                <br />
                Code sent to {maskPhone(phoneNumber)}.
                {isQueued ? ' Delivery in progress...' : ' Usually arrives within 5–15 seconds.'}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Enter 6-Digit Code</Label>
            <InputOTP
              maxLength={6}
              value={code}
              onChange={(value) => {
                console.log('[GHLSmsVerifyDialog] Code input changed', {
                  length: value.length,
                  willAutoSubmit: value.length === 6,
                  currentAttemptId: attemptId
                });
                setCode(value);
                setError('');
                // Auto-submit when all 6 digits are entered
                if (value.length === 6) {
                  console.log('[GHLSmsVerifyDialog] Auto-submitting with attemptId:', attemptId);
                  verifyCode(value);
                }
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
            onClick={() => verifyCode()} 
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


          <Button 
            variant="ghost" 
            onClick={handleReturnToLogin}
            className="w-full mt-2 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Cancel & Return to Login
          </Button>

          <p className="text-xs text-center text-muted-foreground mt-4">
            Having trouble? Contact support for assistance.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};