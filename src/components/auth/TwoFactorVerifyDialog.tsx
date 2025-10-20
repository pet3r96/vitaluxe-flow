import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck, LogOut } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/contexts/AuthContext";

interface TwoFactorVerifyDialogProps {
  open: boolean;
  phoneNumber: string;
}

export const TwoFactorVerifyDialog = ({ open, phoneNumber }: TwoFactorVerifyDialogProps) => {
  const { toast } = useToast();
  const { isImpersonating, clearImpersonation } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [codeSent, setCodeSent] = useState(false);

  const maskPhoneNumber = (phone: string) => {
    if (phone.startsWith('+1')) {
      const digits = phone.slice(2);
      return `***-***-${digits.slice(-4)}`;
    }
    return '***-***-****';
  };

  useEffect(() => {
    if (open && !codeSent) {
      handleSendCode();
    }
  }, [open]);

  const handleSendCode = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { error } = await supabase.functions.invoke('send-2fa-code', {
        body: { 
          phoneNumber,
          codeType: '2fa_login'
        }
      });

      if (error) throw error;

      setCodeSent(true);
      toast({
        title: "Code sent",
        description: "Check your phone for the verification code"
      });

      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send code",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      toast({
        title: "Invalid code",
        description: "Please enter the 6-digit verification code",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('verify-2fa-code', {
        body: { 
          code,
          phoneNumber
        }
      });

      if (error) throw error;

      toast({
        title: "Verified",
        description: "Access granted"
      });

      // Refresh to update auth state
      window.location.reload();

    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.message || "Invalid code",
        variant: "destructive"
      });
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} modal>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <DialogTitle>Verify Your Identity</DialogTitle>
          </div>
          <DialogDescription>
            Enter the verification code sent to {maskPhoneNumber(phoneNumber)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Verification Code</Label>
            <div className="flex justify-center py-4">
              <InputOTP maxLength={6} value={code} onChange={setCode}>
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
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleSendCode}
              disabled={loading || countdown > 0}
              className="flex-1"
            >
              {countdown > 0 ? `Resend (${countdown}s)` : 'Resend Code'}
            </Button>
            <Button
              onClick={handleVerifyCode}
              disabled={loading || code.length !== 6}
              className="flex-1"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify
            </Button>
          </div>

          {isImpersonating && (
            <Button
              variant="outline"
              onClick={clearImpersonation}
              className="w-full"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Return to Admin
            </Button>
          )}

          <p className="text-xs text-center text-muted-foreground">
            Need help? Contact support
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};