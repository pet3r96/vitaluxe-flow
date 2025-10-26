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
  onSave: (address: AddressValue) => void;
}

export function DeliveryAddressEditor({
  open,
  onOpenChange,
  addressType,
  currentAddress,
  onSave,
}: DeliveryAddressEditorProps) {
  const [address, setAddress] = useState<AddressValue>({
    street: currentAddress?.street || "",
    city: currentAddress?.city || "",
    state: currentAddress?.state || "",
    zip: currentAddress?.zip || "",
    formatted: currentAddress ? 
      `${currentAddress.street}, ${currentAddress.city}, ${currentAddress.state} ${currentAddress.zip}` : 
      "",
    status: currentAddress?.street ? "verified" : "unverified",
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
            {addressType === 'practice' ? 'Edit Practice Address' : 'Edit Patient Delivery Address'}
          </DialogTitle>
          <DialogDescription>
            Enter and verify the shipping address. Google address validation will help ensure accurate delivery.
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
