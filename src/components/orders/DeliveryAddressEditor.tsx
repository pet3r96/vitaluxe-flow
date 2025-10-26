import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GoogleAddressAutocomplete, AddressValue } from "@/components/ui/google-address-autocomplete";

interface DeliveryAddressEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addressType: 'practice' | 'patient';
  currentAddress?: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  oldPatientAddress?: string;
  onSave: (address: AddressValue) => void;
}

const parseOldAddress = (oldAddress: string) => {
  // Parse "340 West Flagler Street, Miami, FL 33130-1578, USA"
  const parts = oldAddress.split(',').map(p => p.trim());
  if (parts.length >= 3) {
    const street = parts[0];
    const city = parts[1];
    const stateZipMatch = parts[2].match(/([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/);
    if (stateZipMatch) {
      return {
        street,
        city,
        state: stateZipMatch[1],
        zip: stateZipMatch[2].split('-')[0],
        formatted: oldAddress,
      };
    }
  }
  return null;
}

export function DeliveryAddressEditor({
  open,
  onOpenChange,
  addressType,
  currentAddress,
  oldPatientAddress,
  onSave,
}: DeliveryAddressEditorProps) {
  // Try to parse old address if structured fields are empty
  const parsedOldAddress = oldPatientAddress && !currentAddress?.street 
    ? parseOldAddress(oldPatientAddress) 
    : null;

  const initialAddress = parsedOldAddress || currentAddress;

  const [address, setAddress] = useState<AddressValue>({
    street: initialAddress?.street || "",
    city: initialAddress?.city || "",
    state: initialAddress?.state || "",
    zip: initialAddress?.zip || "",
    formatted: initialAddress ? 
      `${initialAddress.street}, ${initialAddress.city}, ${initialAddress.state} ${initialAddress.zip}` : 
      "",
    status: initialAddress?.street ? "verified" : "unverified",
    source: "google",
  });

  const handleSave = () => {
    if (!address.street || !address.city || !address.state || !address.zip) {
      return;
    }
    onSave(address);
  };

  const isValid = address.street && address.city && address.state && address.zip;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {addressType === 'practice' 
              ? (currentAddress?.street ? 'Edit Practice Address' : 'Add Practice Address')
              : (oldPatientAddress && !currentAddress?.street 
                  ? 'Update Patient Delivery Address' 
                  : 'Edit Patient Delivery Address')}
          </DialogTitle>
          <DialogDescription>
            {oldPatientAddress && !currentAddress?.street 
              ? 'Update and verify the patient delivery address with structured format for accurate shipping.'
              : 'Enter and verify the shipping address. Google address validation will help ensure accurate delivery.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <GoogleAddressAutocomplete
            value={address}
            onChange={setAddress}
            label="Shipping Address"
            required
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isValid}
          >
            Save Address
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
