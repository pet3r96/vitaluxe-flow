import { useState, memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { PhoneInput } from "@/components/ui/phone-input";
import { GoogleAddressAutocomplete, type AddressValue } from "@/components/ui/google-address-autocomplete";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { Mail } from "lucide-react";
import type { PasswordValidationResult } from "@/lib/passwordValidation";

interface SignupFormProps {
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  name: string;
  setName: (name: string) => void;
  role: "doctor" | "pharmacy";
  setRole: (role: "doctor" | "pharmacy") => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  passwordValidation: PasswordValidationResult;
  // Doctor-specific fields
  providerFullName: string;
  setProviderFullName: (name: string) => void;
  prescriberName: string;
  setPrescriberName: (name: string) => void;
  licenseNumber: string;
  setLicenseNumber: (license: string) => void;
  npi: string;
  setNpi: (npi: string) => void;
  practiceNpi: string;
  setPracticeNpi: (npi: string) => void;
  dea: string;
  setDea: (dea: string) => void;
  company: string;
  setCompany: (company: string) => void;
  phone: string;
  setPhone: (phone: string) => void;
  address: AddressValue;
  setAddress: (address: AddressValue) => void;
  // Pharmacy-specific fields
  contactEmail: string;
  setContactEmail: (email: string) => void;
  pharmacyAddress: AddressValue;
  setPharmacyAddress: (address: AddressValue) => void;
  statesServiced: string[];
  setStatesServiced: (states: string[]) => void;
  US_STATES: string[];
}

export const SignupForm = memo(({ 
  email,
  setEmail,
  password,
  setPassword,
  name,
  setName,
  role,
  setRole,
  loading,
  onSubmit,
  passwordValidation,
  providerFullName,
  setProviderFullName,
  prescriberName,
  setPrescriberName,
  licenseNumber,
  setLicenseNumber,
  npi,
  setNpi,
  practiceNpi,
  setPracticeNpi,
  dea,
  setDea,
  company,
  setCompany,
  phone,
  setPhone,
  address,
  setAddress,
  contactEmail,
  setContactEmail,
  pharmacyAddress,
  setPharmacyAddress,
  statesServiced,
  setStatesServiced,
  US_STATES
}: SignupFormProps) => {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>I am a</Label>
        <RadioGroup value={role} onValueChange={(value) => setRole(value as "doctor" | "pharmacy")}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="doctor" id="doctor" />
            <Label htmlFor="doctor" className="cursor-pointer">Medical Practice</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="pharmacy" id="pharmacy" />
            <Label htmlFor="pharmacy" className="cursor-pointer">Pharmacy</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-name">{role === "doctor" ? "Practice Name" : "Pharmacy Name"}</Label>
        <Input
          id="signup-name"
          placeholder={role === "doctor" ? "Enter practice name" : "Enter pharmacy name"}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="signup-email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="pl-10"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-password">Password</Label>
        <Input
          id="signup-password"
          type="password"
          placeholder="Create a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <PasswordStrengthIndicator validation={passwordValidation} />
      </div>

      {role === "doctor" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="provider-full-name">Provider Full Name *</Label>
            <Input
              id="provider-full-name"
              placeholder="John Doe, MD"
              value={providerFullName}
              onChange={(e) => setProviderFullName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prescriber-name">Prescriber Name *</Label>
            <Input
              id="prescriber-name"
              placeholder="As it appears on prescriptions"
              value={prescriberName}
              onChange={(e) => setPrescriberName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="license">Medical License Number *</Label>
              <Input
                id="license"
                placeholder="License #"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="npi">Provider NPI *</Label>
              <Input
                id="npi"
                placeholder="Individual NPI"
                value={npi}
                onChange={(e) => setNpi(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="practice-npi">Practice NPI</Label>
              <Input
                id="practice-npi"
                placeholder="Practice NPI"
                value={practiceNpi}
                onChange={(e) => setPracticeNpi(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dea">DEA Number *</Label>
              <Input
                id="dea"
                placeholder="DEA #"
                value={dea}
                onChange={(e) => setDea(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Company/Clinic Name</Label>
            <Input
              id="company"
              placeholder="Enter company name"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number *</Label>
            <PhoneInput
              value={phone}
              onChange={setPhone}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Practice Address *</Label>
            <GoogleAddressAutocomplete
              value={address}
              onChange={setAddress}
              placeholder="Enter practice address"
              required
            />
          </div>
        </>
      )}

      {role === "pharmacy" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="contact-email">Contact Email</Label>
            <Input
              id="contact-email"
              type="email"
              placeholder="Enter contact email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pharmacy-address">Pharmacy Address *</Label>
            <GoogleAddressAutocomplete
              value={pharmacyAddress}
              onChange={setPharmacyAddress}
              placeholder="Enter pharmacy address"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>States Serviced *</Label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-2 border rounded">
              {US_STATES.map((state) => (
                <div key={state} className="flex items-center space-x-2">
                  <Checkbox
                    id={`state-${state}`}
                    checked={statesServiced.includes(state)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setStatesServiced([...statesServiced, state]);
                      } else {
                        setStatesServiced(statesServiced.filter((s) => s !== state));
                      }
                    }}
                  />
                  <Label htmlFor={`state-${state}`} className="text-sm cursor-pointer">
                    {state}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creating account..." : "Sign Up"}
      </Button>
    </form>
  );
});

SignupForm.displayName = "SignupForm";
