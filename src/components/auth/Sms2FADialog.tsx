import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const LOCK_KEY = 'vitaluxe_sms_send_lock';
const COOLDOWN_KEY = 'vitaluxe_sms_send_cooldown';
const LOCK_TTL = 15000; // 15s lock

interface LockData {
  timestamp: number;
  userId: string;
}

interface Sms2FADialogProps {
  open: boolean;
  userId: string;
  phone?: string;
}

export const Sms2FADialog = ({ open, userId, phone }: Sms2FADialogProps) => {
  const auth = useAuth();
  const [step, setStep] = useState<'phone' | 'verify'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [attemptId, setAttemptId] = useState<string>('');

  // Check cross-tab cooldown
  const checkSharedCooldown = useCallback(() => {
    const cooldownStr = localStorage.getItem(COOLDOWN_KEY);
    if (!cooldownStr) return 0;
    try {
      const data = JSON.parse(cooldownStr);
      if (data.userId !== userId) return 0;
      const elapsed = Date.now() - data.timestamp;
      const remaining = 60000 - elapsed;
      return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
    } catch {
      return 0;
    }
  }, [userId]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Listen for storage events (cross-tab)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === COOLDOWN_KEY && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data.userId === userId) {
            const elapsed = Date.now() - data.timestamp;
            const remaining = 60000 - elapsed;
            if (remaining > 0) {
              setCountdown(Math.ceil(remaining / 1000));
            }
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [userId]);

  // Auto-send on mount if phone is provided (verify mode)
  useEffect(() => {
    if (open && phone && !codeSent && step === 'phone') {
      // Validate phone before proceeding
      if (!isValidPhone(phone)) {
        console.log('[Sms2FADialog] Invalid phone prop provided, showing phone input');
        return;
      }
      
      setPhoneNumber(phone);
      const existing = checkSharedCooldown();
      if (existing > 0) {
        setStep('verify');
        setCountdown(existing);
        setCodeSent(true);
      } else {
        // Don't set step yet, let sendCode do it on success
        sendCode(phone);
      }
    }
  }, [open, phone, codeSent, step, checkSharedCooldown]);

  const maskPhone = (num: string) => {
    const digits = num.replace(/\D/g, '');
    if (digits.length < 4) return '***-***-****';
    return `***-***-${digits.slice(-4)}`;
  };

  const handleReturnToLogin = async () => {
    console.log('[Sms2FADialog] Return to login clicked');
    await supabase.auth.signOut();
    window.location.assign('/auth');
  };

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  // Normalize phone to E.164 format (+1XXXXXXXXXX)
  const normalizePhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    // Accept 10-digit (US) or 11-digit (already has +1)
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    }
    return phone; // Return as-is if unexpected format
  };

  const isValidPhone = (num: string) => {
    const digits = num.replace(/\D/g, '');
    return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
  };

  const sendCode = async (targetPhone?: string) => {
    const phoneToUse = targetPhone || phoneNumber;
    
    // Only validate phone if we're in setup mode (no phone prop provided initially)
    if (!phone && !isValidPhone(phoneToUse)) {
      setError('Please enter a valid US phone number (10 digits)');
      return;
    }

    // Check cross-tab lock
    const lockStr = localStorage.getItem(LOCK_KEY);
    if (lockStr) {
      try {
        const lockData: LockData = JSON.parse(lockStr);
        const age = Date.now() - lockData.timestamp;
        if (age < LOCK_TTL && lockData.userId === userId) {
          console.log('[Sms2FADialog] Another tab is sending SMS, waiting');
          setError('Another tab is sending a code, please wait...');
          setTimeout(() => setError(''), 3000);
          return;
        }
      } catch {}
    }

    // Set cross-tab lock
    const lockData: LockData = { timestamp: Date.now(), userId };
    localStorage.setItem(LOCK_KEY, JSON.stringify(lockData));

    setLoading(true);
    setError('');

    try {
      const normalizedPhone = normalizePhone(phoneToUse);

      console.log('[Sms2FADialog] Sending SMS to:', maskPhone(normalizedPhone));

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const { data, error: fnError } = await supabase.functions.invoke('send-2fa-sms', {
        body: { phoneNumber: normalizedPhone, purpose: 'verify' },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (fnError) throw fnError;
      
      if (!data?.success || !data?.attemptId) {
        throw new Error(data?.error || 'Failed to send verification code');
      }

      console.log('[Sms2FADialog] SMS sent successfully, attemptId:', data.attemptId);

      setAttemptId(data.attemptId);
      setCodeSent(true);
      setStep('verify');
      setCountdown(60);

      // Set cooldown in storage
      localStorage.setItem(COOLDOWN_KEY, JSON.stringify({ timestamp: Date.now(), userId }));

    } catch (err: any) {
      console.error('[Sms2FADialog] Send SMS error:', err);
      setError(err.message || 'Failed to send verification code');
      setCodeSent(false);
      setAttemptId('');
      // Don't change step - keep user on current step
    } finally {
      setLoading(false);
      // Remove lock after 15s
      setTimeout(() => {
        const currentLock = localStorage.getItem(LOCK_KEY);
        if (currentLock) {
          try {
            const data = JSON.parse(currentLock);
            if (data.userId === userId) {
              localStorage.removeItem(LOCK_KEY);
            }
          } catch {}
        }
      }, LOCK_TTL);
    }
  };

  const resendCode = () => {
    setCode('');
    setCodeSent(false);
    setError('');
    sendCode();
  };

  const verifyCode = async () => {
    if (code.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }
    
    if (!attemptId) {
      setError('No verification attempt found. Please resend code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const normalizedPhone = normalizePhone(phoneNumber);

      console.log('[Sms2FADialog] Verifying code for attemptId:', attemptId);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const { data, error: fnError } = await supabase.functions.invoke('verify-2fa-sms', {
        body: {
          attemptId,
          code,
          phoneNumber: normalizedPhone
        },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (fnError) throw fnError;

      if (!data?.success) {
        throw new Error(data?.error || 'Verification failed');
      }

      console.log('[Sms2FADialog] ✅ Verification successful');

      // Determine if this is setup (new phone) or verify (existing phone)
      const isSetup = !phone; // If no phone prop was provided, this is setup
      
      // Update auth context
      if (isSetup && auth.mark2FAEnrolled) {
        auth.mark2FAEnrolled(normalizedPhone);
      } else {
        auth.mark2FAVerified();
      }

      // Best-effort DB check (non-blocking)
      try {
        const { data: settingsData } = await supabase
          .from('user_2fa_settings')
          .select('is_enrolled, phone_verified')
          .eq('user_id', userId)
          .maybeSingle();
        console.log('[Sms2FADialog] DB verification (non-blocking):', settingsData);
      } catch (dbErr) {
        console.warn('[Sms2FADialog] DB check failed (non-fatal):', dbErr);
      }

      // Immediate redirect if on auth page
      if (window.location.pathname === '/auth') {
        console.log('[Sms2FADialog] Redirecting to home...');
        window.location.assign('/');
      }

    } catch (err: any) {
      console.error('[Sms2FADialog] Verify error:', err);
      setError(err.message || 'Invalid or expired code');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit when code is complete
  useEffect(() => {
    if (code.length === 6 && !loading) {
      verifyCode();
    }
  }, [code]);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            {step === 'phone' ? 'Setup Two-Factor Authentication' : 'Enter Verification Code'}
          </DialogTitle>
          <DialogDescription>
            {step === 'phone'
              ? 'Enter your US phone number to receive a verification code'
              : `We've sent a 6-digit code to ${maskPhone(phoneNumber)}`}
          </DialogDescription>
        </DialogHeader>

        {step === 'phone' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="flex gap-2">
                <span className="flex items-center px-3 bg-muted rounded-md text-sm">+1</span>
                <Input
                  id="phone"
                  placeholder="555-123-4567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
                  maxLength={12}
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleReturnToLogin}
                disabled={loading}
              >
                Cancel & Return to Login
              </Button>
              <Button
                onClick={() => sendCode()}
                disabled={loading || !isValidPhone(phoneNumber)}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Code'}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(value) => setCode(value)}
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

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="text-sm text-muted-foreground text-center">
              {codeSent && countdown === 0 && (
                <Button
                  variant="link"
                  onClick={resendCode}
                  disabled={loading}
                  className="p-0 h-auto"
                >
                  Resend Code
                </Button>
              )}
              {countdown > 0 && (
                <span>Resend code in {countdown}s</span>
              )}
            </div>

            <DialogFooter className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleReturnToLogin}
                disabled={loading}
              >
                Cancel & Return to Login
              </Button>
              <Button
                onClick={verifyCode}
                disabled={loading || code.length !== 6}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify Code'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
