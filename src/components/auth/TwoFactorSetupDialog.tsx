import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck, LogOut } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/contexts/AuthContext";

interface TwoFactorSetupDialogProps {
  open: boolean;
  userId: string;
}

export const TwoFactorSetupDialog = ({ open, userId }: TwoFactorSetupDialogProps) => {
  const { toast } = useToast();
  const { isImpersonating, clearImpersonation } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState("+1");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "verify">("phone");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    
    // Always start with +1 for US numbers
    if (digits.length === 0 || digits.length === 1) return '+1';
    
    // Format: +1-XXX-XXX-XXXX
    if (digits.length <= 4) return `+1-${digits.slice(1)}`;
    if (digits.length <= 7) return `+1-${digits.slice(1, 4)}-${digits.slice(4)}`;
    return `+1-${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Prevent removing the +1 prefix
    if (value.length < 2 || !value.startsWith('+1')) {
      setPhoneNumber('+1');
      return;
    }
    
    const formatted = formatPhoneNumber(value);
    setPhoneNumber(formatted);
  };

  const handleSendCode = async () => {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    
    // Must be exactly 11 digits (1 + 10 digit US number)
    if (cleanPhone.length !== 11 || !cleanPhone.startsWith('1')) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid 10-digit US phone number",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { error } = await supabase.functions.invoke('send-2fa-code', {
        body: { 
          phoneNumber: `+${cleanPhone}`,
          codeType: '2fa_setup'
        }
      });

      if (error) throw error;

      toast({
        title: "Code sent",
        description: "Check your phone for the verification code"
      });

      setStep("verify");
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
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('verify-2fa-code', {
        body: { 
          code,
          phoneNumber: `+${cleanPhone}`
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Phone number verified successfully"
      });

      // Refresh the page to update auth state
      window.location.reload();

    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.message || "Invalid code",
        variant: "destructive"
      });
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
            <DialogTitle>Secure Your Account</DialogTitle>
          </div>
          <DialogDescription>
            Two-factor authentication adds an extra layer of security to your account
          </DialogDescription>
        </DialogHeader>

        {step === "phone" ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1-555-123-4567"
                value={phoneNumber}
                onChange={handlePhoneChange}
                maxLength={16}
              />
              <p className="text-xs text-muted-foreground">
                US phone numbers only. Enter 10 digits after +1.
              </p>
            </div>

            <Button 
              onClick={handleSendCode} 
              disabled={loading || phoneNumber.replace(/\D/g, '').length !== 11}
              className="w-full"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Verification Code
            </Button>

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
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Enter Verification Code</Label>
              <p className="text-sm text-muted-foreground">
                We sent a code to {phoneNumber}
              </p>
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

            <Button
              variant="ghost"
              onClick={() => {
                setStep("phone");
                setCode("");
              }}
              className="w-full"
            >
              Change Phone Number
            </Button>

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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};