import { memo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { GoogleAddressAutocomplete, type AddressValue } from "@/components/ui/google-address-autocomplete";

interface DoctorSignupFieldsProps {
  providerFullName: string;
  setProviderFullName: (value: string) => void;
  prescriberName: string;
  setPrescriberName: (value: string) => void;
  licenseNumber: string;
  setLicenseNumber: (value: string) => void;
  npi: string;
  setNpi: (value: string) => void;
  practiceNpi: string;
  setPracticeNpi: (value: string) => void;
  dea: string;
  setDea: (value: string) => void;
  company: string;
  setCompany: (value: string) => void;
  phone: string;
  setPhone: (value: string) => void;
  address: AddressValue;
  setAddress: (value: AddressValue) => void;
}

export const DoctorSignupFields = memo(({
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
  setAddress
}: DoctorSignupFieldsProps) => {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="providerFullName">Provider Full Name *</Label>
        <Input
          id="providerFullName"
          placeholder="Dr. John Smith"
          value={providerFullName}
          onChange={(e) => setProviderFullName(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="prescriberName">Prescriber Name (for Rx) *</Label>
        <Input
          id="prescriberName"
          placeholder="John Smith, MD"
          value={prescriberName}
          onChange={(e) => setPrescriberName(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="licenseNumber">License Number *</Label>
        <Input
          id="licenseNumber"
          placeholder="Medical License Number"
          value={licenseNumber}
          onChange={(e) => setLicenseNumber(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="npi">Provider NPI *</Label>
        <Input
          id="npi"
          placeholder="Individual NPI (10 digits)"
          value={npi}
          onChange={(e) => setNpi(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="practiceNpi">Practice NPI</Label>
        <Input
          id="practiceNpi"
          placeholder="Practice NPI (10 digits) - Optional"
          value={practiceNpi}
          onChange={(e) => setPracticeNpi(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="dea">DEA Number *</Label>
        <Input
          id="dea"
          placeholder="DEA Registration Number"
          value={dea}
          onChange={(e) => setDea(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="company">Practice Name *</Label>
        <Input
          id="company"
          placeholder="Your practice or clinic name"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone *</Label>
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
          placeholder="Enter your practice address"
          required
        />
      </div>
    </>
  );
});

DoctorSignupFields.displayName = "DoctorSignupFields";
