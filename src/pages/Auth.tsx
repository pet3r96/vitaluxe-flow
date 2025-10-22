import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/vitaluxe-logo-dark-bg.png";
import ForgotPasswordDialog from "@/components/auth/ForgotPasswordDialog";
import { validatePasswordStrength } from "@/lib/passwordStrength";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Mail, CheckCircle2, AlertCircle } from "lucide-react";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"doctor" | "pharmacy">("doctor"); // "doctor" = Practice in the database
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [showVerificationReminder, setShowVerificationReminder] = useState(false);
  const [reminderEmail, setReminderEmail] = useState("");
  const [emergencyResetStatus, setEmergencyResetStatus] = useState<{
    triggered: boolean;
    loading: boolean;
    message: string;
    success: boolean;
  } | null>(null);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  // Doctor-specific fields
  const [providerFullName, setProviderFullName] = useState("");
  const [prescriberName, setPrescriberName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [npi, setNpi] = useState("");
  const [practiceNpi, setPracticeNpi] = useState("");
  const [dea, setDea] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  // Pharmacy-specific fields
  const [contactEmail, setContactEmail] = useState("");
  const [pharmacyAddress, setPharmacyAddress] = useState("");
  const [statesServiced, setStatesServiced] = useState<string[]>([]);

  const US_STATES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
  ];

  // Emergency reset removed - use admin role-based checks instead

  // Force loading to clear after 10 seconds as a failsafe
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        console.warn('Login timeout - forcing loading clear');
        setLoading(false);
        toast({
          title: "Login Timeout",
          description: "The login process took too long. Please try again.",
          variant: "destructive",
        });
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [loading, toast]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!email || !password) {
      toast({
        title: "Error",
        description: "Please fill in email and password",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (!isLogin && !name) {
      toast({
        title: "Error",
        description: "Please provide your full name",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Validate password strength for signup
    if (!isLogin) {
      const passwordValidation = validatePasswordStrength(password, email);
      if (!passwordValidation.valid) {
        toast({
          title: "Weak Password",
          description: passwordValidation.feedback || "Password does not meet security requirements",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
    }

    // Validate role-specific fields for signup
    if (!isLogin) {
      if (role === "doctor") {
        if (!providerFullName || !prescriberName || !licenseNumber || !npi) {
          toast({
            title: "Error",
            description: "Please provide Provider Full Name, Prescriber Name, License Number and NPI",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      } else if (role === "pharmacy") {
        if (!contactEmail || statesServiced.length === 0) {
          toast({
            title: "Error",
            description: "Please provide Contact Email and select at least one state",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }
    }

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          // Check if this is an email verification error
          if ((error as any).code === 'email_not_verified') {
            setReminderEmail((error as any).email || email);
            setShowVerificationReminder(true);
            setLoading(false);
            return;
          }
          
          // Track failed login attempt
          try {
            await supabase.functions.invoke("track-failed-login", {
              body: {
                email,
                ip_address: "browser",
                user_agent: navigator.userAgent,
              },
            });
          } catch (trackError) {
            import('@/lib/logger').then(({ logger }) => {
              logger.error("Failed to track login attempt", trackError);
            });
          }
          
          toast({
            title: "Error",
            description: error.message || "Failed to sign in",
            variant: "destructive",
          });
        }
      } else {
        const roleData = role === "doctor" 
          ? {
              licenseNumber,
              npi,
              practiceNpi,
              dea,
              company,
              phone,
              address,
            }
          : {
              contactEmail,
              address: pharmacyAddress,
              statesServiced,
            };

        const { error } = await signUp(email, password, name, role, roleData, providerFullName, prescriberName);
        if (error) {
          toast({
            title: "Error",
            description: error.message || "Failed to sign up",
            variant: "destructive",
          });
        } else {
          setShowVerificationMessage(true);
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Full-screen verification reminder (for login attempts with unverified email)
  if (showVerificationReminder) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-2xl text-center space-y-6">
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-warning" />
            </div>
          </div>
          
          <h1 className="text-4xl font-bold text-foreground">
            Please Verify Your Email
          </h1>
          
          <div className="space-y-4 text-lg text-muted-foreground">
            <p>
              Your account with{" "}
              <span className="text-foreground font-semibold">{reminderEmail}</span>{" "}
              needs to be verified before you can sign in.
            </p>
            
            <p className="text-base">
              Please check your inbox (and spam folder) for the verification email we sent when you created your account.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Button
              onClick={async () => {
                try {
                  setLoading(true);
                  const { error } = await supabase.functions.invoke('send-verification-email', {
                    body: { email: reminderEmail }
                  });
                  
                  if (error) throw error;
                  
                  toast({
                    title: "Email Sent",
                    description: "A new verification email has been sent. Please check your inbox.",
                  });
                } catch (error: any) {
                  toast({
                    variant: "destructive",
                    title: "Error",
                    description: error.message || "Failed to resend verification email",
                  });
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              size="lg"
              className="gap-2"
            >
              <Mail className="w-4 h-4" />
              Resend Verification Email
            </Button>
            
            <Button
              onClick={() => {
                setShowVerificationReminder(false);
                setReminderEmail("");
              }}
              variant="outline"
              size="lg"
            >
              Back to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Full-screen verification message (for successful signup)
  if (showVerificationMessage && !isLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-2xl text-center space-y-6">
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-primary" />
            </div>
          </div>
          
          <h1 className="text-4xl font-bold text-foreground">
            Verification Email Sent!
          </h1>
          
          <div className="space-y-4 text-lg text-muted-foreground">
            <p>
              We've sent a verification link to{" "}
              <span className="text-foreground font-semibold">{email}</span>. 
              Please check your inbox and click the link to activate your account.
            </p>
            
            <p className="text-base">
              Didn't receive the email? Check your spam folder or{" "}
              <button
                onClick={() => setShowVerificationMessage(false)}
                className="text-primary hover:underline font-medium"
              >
                try signing up again
              </button>.
            </p>
          </div>

          <div className="pt-8">
            <p className="text-sm text-muted-foreground mb-3">
              Already verified your email?
            </p>
            <Button
              onClick={() => {
                setIsLogin(true);
                setShowVerificationMessage(false);
              }}
              variant="outline"
              size="lg"
              className="gap-2"
            >
              Sign In with Your Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8 bg-card border-border shadow-gold">
        <div className="flex flex-center justify-center mb-8">
          <img src={logo} alt="Vitaluxe Services" className="h-32 w-auto" />
        </div>
        
        <p className="text-center text-muted-foreground mb-4">
          {isLogin ? "Sign in to your account" : "Create your account"}
        </p>

        {isLogin && !showVerificationMessage && (
          <div className="mb-6 flex items-start gap-2 rounded-lg bg-accent/50 border border-border/50 p-3 backdrop-blur-sm">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-xs text-white leading-relaxed">
              For your security, you'll be automatically logged out after 30 minutes of inactivity.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Practice Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme Medical Spa"
                  className="bg-input border-border text-foreground"
                  required
                />
              </div>

              <div className="space-y-3">
                <Label>I am a:</Label>
                <RadioGroup value={role} onValueChange={(value) => setRole(value as "doctor" | "pharmacy")}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="doctor" id="doctor" />
                    <Label htmlFor="doctor" className="font-normal cursor-pointer">
                      Practice
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pharmacy" id="pharmacy" />
                    <Label htmlFor="pharmacy" className="font-normal cursor-pointer">
                      Pharmacy
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {role === "doctor" && (
                <>
                  {/* Practice Information Section */}
                  <div className="pt-4 pb-2">
                    <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">
                      Practice Information
                    </h3>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="practiceNpi">Practice NPI</Label>
                    <Input
                      id="practiceNpi"
                      type="text"
                      value={practiceNpi}
                      onChange={(e) => setPracticeNpi(e.target.value)}
                      placeholder="Your practice or organization's NPI"
                      className="bg-input border-border text-foreground"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                      className="bg-input border-border text-foreground"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Practice Address"
                      className="bg-input border-border text-foreground"
                    />
                  </div>

                  {/* Provider Information Section */}
                  <div className="pt-4 pb-2">
                    <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">
                      Provider Information
                    </h3>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="providerFullName">Provider Full Name *</Label>
                    <Input
                      id="providerFullName"
                      type="text"
                      value={providerFullName}
                      onChange={(e) => setProviderFullName(e.target.value)}
                      placeholder="Dr. John Doe"
                      className="bg-input border-border text-foreground"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="prescriberName">Prescriber Name *</Label>
                    <Input
                      id="prescriberName"
                      type="text"
                      value={prescriberName}
                      onChange={(e) => setPrescriberName(e.target.value)}
                      placeholder="Name as it appears on prescriptions"
                      className="bg-input border-border text-foreground"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="licenseNumber">License Number *</Label>
                    <Input
                      id="licenseNumber"
                      type="text"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      placeholder="Medical License Number"
                      className="bg-input border-border text-foreground"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="npi">Provider NPI # *</Label>
                    <Input
                      id="npi"
                      type="text"
                      value={npi}
                      onChange={(e) => setNpi(e.target.value)}
                      placeholder="10-digit NPI number"
                      className={`bg-input border-border text-foreground ${
                        npi && npi.length !== 10 && npi.length > 0 ? 'border-destructive' : ''
                      }`}
                      maxLength={10}
                      required
                    />
                    {npi && npi.length > 0 && npi.length !== 10 && (
                      <p className="text-xs text-destructive">NPI must be exactly 10 digits</p>
                    )}
                    {(!npi || npi.length === 0) && (
                      <p className="text-xs text-muted-foreground">Enter your 10-digit National Provider Identifier</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dea">Provider DEA #</Label>
                    <Input
                      id="dea"
                      type="text"
                      value={dea}
                      onChange={(e) => setDea(e.target.value)}
                      placeholder="DEA Number (optional)"
                      className="bg-input border-border text-foreground"
                    />
                  </div>
                </>
              )}

              {role === "pharmacy" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">Contact Email *</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="pharmacy@example.com"
                      className="bg-input border-border text-foreground"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pharmacyAddress">Address</Label>
                    <Input
                      id="pharmacyAddress"
                      type="text"
                      value={pharmacyAddress}
                      onChange={(e) => setPharmacyAddress(e.target.value)}
                      placeholder="Pharmacy Address"
                      className="bg-input border-border text-foreground"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>States Serviced *</Label>
                    <div className="grid grid-cols-5 gap-2 max-h-40 overflow-y-auto p-2 border border-border rounded-md">
                      {US_STATES.map((state) => (
                        <div key={state} className="flex items-center space-x-2">
                          <Checkbox
                            id={state}
                            checked={statesServiced.includes(state)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setStatesServiced([...statesServiced, state]);
                              } else {
                                setStatesServiced(statesServiced.filter((s) => s !== state));
                              }
                            }}
                          />
                          <Label htmlFor={state} className="text-xs font-normal cursor-pointer">
                            {state}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="bg-input border-border text-foreground"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-input border-border text-foreground"
              required
            />
            {!isLogin && password && (
              <PasswordStrengthIndicator 
                validation={validatePasswordStrength(password, email)}
              />
            )}
          </div>

          {isLogin && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-primary hover:underline"
              >
                Forgot Password?
              </button>
            </div>
          )}

          <Button
            type="submit"
            className="w-full gold-gradient text-primary-foreground font-semibold"
            disabled={loading}
          >
            {loading ? "Please wait..." : isLogin ? "Sign In" : "Sign Up"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary hover:underline"
          >
            {isLogin
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </Card>

      <ForgotPasswordDialog 
        open={showForgotPassword}
        onOpenChange={setShowForgotPassword}
      />
    </div>
  );
};

export default Auth;
