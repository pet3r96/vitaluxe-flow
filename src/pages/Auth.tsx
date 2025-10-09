import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/vitaluxe-services-logo.png";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"doctor" | "pharmacy">("doctor");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  // Doctor-specific fields
  const [licenseNumber, setLicenseNumber] = useState("");
  const [npi, setNpi] = useState("");
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

    // Validate role-specific fields for signup
    if (!isLogin) {
      if (role === "doctor") {
        if (!licenseNumber || !npi) {
          toast({
            title: "Error",
            description: "Please provide License Number and NPI",
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

        const { error } = await signUp(email, password, name, role, roleData);
        if (error) {
          toast({
            title: "Error",
            description: error.message || "Failed to sign up",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Success",
            description: "Account created successfully! You can now sign in.",
          });
          setIsLogin(true);
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8 bg-card border-border shadow-gold">
        <div className="flex flex-center justify-center mb-8">
          <img src={logo} alt="Vitaluxe Services" className="h-32 w-auto" />
        </div>
        
        <p className="text-center text-muted-foreground mb-8">
          {isLogin ? "Sign in to your account" : "Create your account"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
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
                      Doctor / Medical Spa
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
                  <div className="space-y-2">
                    <Label htmlFor="licenseNumber">License Number *</Label>
                    <Input
                      id="licenseNumber"
                      type="text"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      placeholder="License Number"
                      className="bg-input border-border text-foreground"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="npi">NPI *</Label>
                    <Input
                      id="npi"
                      type="text"
                      value={npi}
                      onChange={(e) => setNpi(e.target.value)}
                      placeholder="National Provider Identifier"
                      className="bg-input border-border text-foreground"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dea">DEA</Label>
                    <Input
                      id="dea"
                      type="text"
                      value={dea}
                      onChange={(e) => setDea(e.target.value)}
                      placeholder="DEA Number"
                      className="bg-input border-border text-foreground"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company">Company / Practice</Label>
                    <Input
                      id="company"
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Practice Name"
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
          </div>

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
    </div>
  );
};

export default Auth;
