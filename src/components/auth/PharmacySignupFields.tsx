import { memo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { GoogleAddressAutocomplete, type AddressValue } from "@/components/ui/google-address-autocomplete";
import { Checkbox } from "@/components/ui/checkbox";

interface PharmacySignupFieldsProps {
  contactEmail: string;
  setContactEmail: (value: string) => void;
  pharmacyAddress: AddressValue;
  setPharmacyAddress: (value: AddressValue) => void;
  statesServiced: string[];
  setStatesServiced: (value: string[]) => void;
  US_STATES: string[];
}

export const PharmacySignupFields = memo(({
  contactEmail,
  setContactEmail,
  pharmacyAddress,
  setPharmacyAddress,
  statesServiced,
  setStatesServiced,
  US_STATES
}: PharmacySignupFieldsProps) => {
  const handleStateToggle = (state: string) => {
    setStatesServiced(
      statesServiced.includes(state) 
        ? statesServiced.filter(s => s !== state)
        : [...statesServiced, state]
    );
  };

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="contactEmail">Contact Email *</Label>
        <Input
          id="contactEmail"
          type="email"
          placeholder="pharmacy@example.com"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="pharmacyAddress">Pharmacy Address *</Label>
        <GoogleAddressAutocomplete
          value={pharmacyAddress}
          onChange={setPharmacyAddress}
          placeholder="Enter your pharmacy address"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>States Serviced *</Label>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-2 border rounded-md">
          {US_STATES.map(state => (
            <div key={state} className="flex items-center space-x-2">
              <Checkbox
                id={`state-${state}`}
                checked={statesServiced.includes(state)}
                onCheckedChange={() => handleStateToggle(state)}
              />
              <Label 
                htmlFor={`state-${state}`}
                className="text-sm cursor-pointer"
              >
                {state}
              </Label>
            </div>
          ))}
        </div>
        {statesServiced.length === 0 && (
          <p className="text-sm text-destructive">Please select at least one state</p>
        )}
      </div>
    </>
  );
});

PharmacySignupFields.displayName = "PharmacySignupFields";
