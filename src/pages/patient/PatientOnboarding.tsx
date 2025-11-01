import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

export default function PatientOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");

  const handleComplete = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create patient account  
      const { data: accountData, error: accountError } = await supabase
        .from("patient_accounts")
        .insert([{
          email: user.email!,
          first_name: formData.get("first_name") as string,
          last_name: formData.get("last_name") as string,
          phone: phone,
          date_of_birth: formData.get("date_of_birth") as string,
          address: formData.get("address") as string,
          city: formData.get("city") as string,
          state: formData.get("state") as string,
          zip_code: formData.get("zip_code") as string,
        } as any])
        .select()
        .single();

      if (accountError) throw accountError;

      // Create medical vault
      const allergies = formData.get("allergies")?.toString().split(",").map(a => a.trim()).filter(Boolean) || [];
      const medications = formData.get("medications")?.toString().split(",").map(m => m.trim()).filter(Boolean) || [];
      const conditions = formData.get("conditions")?.toString().split(",").map(c => c.trim()).filter(Boolean) || [];
      
      await supabase.from("patient_medical_vault").insert([{
        allergies: allergies,
        current_medications: medications,
        medical_conditions: conditions,
      } as any]);

      toast.success("Welcome to VitaLuxePro!");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="patient-card w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl">Welcome to VitaLuxePro</CardTitle>
          <CardDescription>Let's set up your patient portal</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleComplete} className="space-y-6">
            {step === 1 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Personal Information</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input id="first_name" name="first_name" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name *</Label>
                    <Input id="last_name" name="last_name" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth">Date of Birth *</Label>
                    <Input id="date_of_birth" name="date_of_birth" type="date" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone *</Label>
                    <PhoneInput
                      id="phone"
                      value={phone}
                      onChange={setPhone}
                      placeholder="(555) 123-4567"
                      required
                    />
                  </div>
                </div>
                <Button type="button" onClick={() => setStep(2)} className="w-full touch-target">
                  Continue
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Address</h3>
                <div className="space-y-2">
                  <Label htmlFor="address">Street Address</Label>
                  <Input id="address" name="address" />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" name="city" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input id="state" name="state" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zip_code">ZIP Code</Label>
                    <Input id="zip_code" name="zip_code" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1 touch-target">
                    Back
                  </Button>
                  <Button type="button" onClick={() => setStep(3)} className="flex-1 touch-target">
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Medical History (Optional)</h3>
                <div className="space-y-2">
                  <Label htmlFor="allergies">Allergies (comma-separated)</Label>
                  <Textarea id="allergies" name="allergies" placeholder="e.g., Penicillin, Peanuts" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="medications">Current Medications (comma-separated)</Label>
                  <Textarea id="medications" name="medications" placeholder="e.g., Lisinopril 10mg, Metformin 500mg" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="conditions">Medical Conditions (comma-separated)</Label>
                  <Textarea id="conditions" name="conditions" placeholder="e.g., Hypertension, Type 2 Diabetes" />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep(2)} className="flex-1 touch-target">
                    Back
                  </Button>
                  <Button type="submit" disabled={loading} className="flex-1 touch-target">
                    {loading ? "Setting up..." : "Complete Setup"}
                    <CheckCircle2 className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
