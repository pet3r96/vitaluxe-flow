import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface GHLSmsSetupDialogProps {
  open: boolean;
  userId: string;
}

export const GHLSmsSetupDialog = ({ open, userId }: GHLSmsSetupDialogProps) => {
  const [step, setStep] = useState<'phone' | 'verify'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length === 0) return '';
    if (cleaned.length <= 3) return `+${cleaned}`;
    if (cleaned.length <= 6) return `+${cleaned.slice(0, 1)}-${cleaned.slice(1, 4)}-${cleaned.slice(4)}`;
    if (cleaned.length <= 10) return `+${cleaned.slice(0, 1)}-${cleaned.slice(1, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    return `+${cleaned.slice(0, 1)}-${cleaned.slice(1, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
    setError('');
  };

  const isValidPhone = () => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 10;
  };

  const sendCode = async () => {
    if (!isValidPhone()) {
      setError('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const cleanedPhone = '+' + phone.replace(/\D/g, '');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const { data, error } = await supabase.functions.invoke('send-ghl-sms', {
        body: { phoneNumber: cleanedPhone, purpose: 'enrollment' }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success('Verification code sent!');
      setStep('verify');
      setCountdown(300);
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
    setCountdown(300);
    await sendCode();
  };

  const verifyCode = async () => {
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No active session. Please log in again.');
      }

      console.log('[GHLSmsSetupDialog] Calling verify-ghl-sms with code:', code.substring(0, 3) + '***');

      const { data, error } = await supabase.functions.invoke('verify-ghl-sms', {
        body: { code },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      console.log('[GHLSmsSetupDialog] Response:', { success: !error, hasData: !!data });

      if (error) {
        console.error('[GHLSmsSetupDialog] Invoke error:', error);
        throw error;
      }
      if (data?.error) {
        console.error('[GHLSmsSetupDialog] Function error:', data.error);
        throw new Error(data.error);
      }

      toast.success('Phone verified! Reloading...');
      console.log('[GHLSmsSetupDialog] Success - reloading page');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      console.error('[GHLSmsSetupDialog] Verification failed:', err);
      setError(err.message || 'Invalid verification code');
      if (err.message?.includes('attempts remaining')) {
        toast.error(err.message);
      } else {
        toast.error('Invalid code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const maskPhone = (phoneNum: string) => {
    const cleaned = phoneNum.replace(/\D/g, '');
    if (cleaned.length >= 10) {
      return `+${cleaned.slice(0, 1)}-XXX-XXX-${cleaned.slice(-4)}`;
    }
    return phoneNum;
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>🔒 Mandatory 2FA Setup</DialogTitle>
          <DialogDescription>
            For your security, you must set up SMS verification to access your account.
          </DialogDescription>
        </DialogHeader>

        {step === 'phone' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Mobile Phone Number</Label>
              <Input
                id="phone"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="+1-555-123-4567"
                disabled={loading}
                maxLength={16}
              />
              <p className="text-xs text-muted-foreground">
                Enter your phone number in the format: +1-555-123-4567
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                {error}
              </Alert>
            )}

            <Button 
              onClick={sendCode} 
              disabled={!isValidPhone() || loading}
              className="w-full"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Sending...' : 'Send Verification Code'}
            </Button>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Code sent to <span className="font-semibold">{maskPhone(phone)}</span>
            </p>

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
              {countdown > 0 ? `Resend in ${formatCountdown(countdown)}` : 'Resend Code'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};