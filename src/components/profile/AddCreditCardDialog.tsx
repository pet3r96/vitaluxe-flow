import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tokenizeCard, detectCardType } from "@/lib/authorizenet-acceptjs";
import { BillingAddress } from "@/types/payment";
import { AddressInput } from "@/components/ui/address-input";

interface AddCreditCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultBillingAddress?: Partial<BillingAddress>;
  onSuccess?: () => void;
  practiceId?: string;
}

export const AddCreditCardDialog = ({ 
  open, 
  onOpenChange,
  defaultBillingAddress,
  onSuccess,
  practiceId
}: AddCreditCardDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [cardNumber, setCardNumber] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [cvv, setCvv] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [billingAddress, setBillingAddress] = useState<BillingAddress & {
    formatted?: string;
    status?: string;
    verified_at?: string;
    source?: string;
  }>({
    street: defaultBillingAddress?.street || "",
    city: defaultBillingAddress?.city || "",
    state: defaultBillingAddress?.state || "",
    zip: defaultBillingAddress?.zip || "",
  });

  const addCardMutation = useMutation({
    mutationFn: async () => {
      // Tokenize card using Accept.js (placeholder mode)
      const tokenResult = await tokenizeCard({
        cardNumber,
        expiryMonth,
        expiryYear,
        cvv,
      });

      if (!tokenResult.success) {
        throw new Error('Card tokenization failed');
      }

      const cardType = detectCardType(cardNumber);
      const cardLastFive = cardNumber.replace(/\s/g, '').slice(-5);
      const cardExpiry = `${expiryMonth.padStart(2, '0')}/${expiryYear.padStart(2, '0')}`;

      const { data, error } = await supabase.functions.invoke('authorizenet-create-customer-profile', {
        body: {
          payment_type: 'credit_card',
          payment_nonce: tokenResult.opaqueData?.dataValue,
          payment_descriptor: tokenResult.opaqueData?.dataDescriptor,
          card_type: cardType,
          card_last_five: cardLastFive,
          card_expiry: cardExpiry,
          cardholder_name: cardholderName,
          billing_address: billingAddress,
          is_default: false,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.message || 'Failed to add card');
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods', practiceId] });
      toast({
        title: "Card Added",
        description: "Your credit card has been added successfully.",
      });
      onOpenChange(false);
      resetForm();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add credit card",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setCardNumber("");
    setExpiryMonth("");
    setExpiryYear("");
    setCvv("");
    setCardholderName("");
  };

  const handleAddressChange = (address: any) => {
    setBillingAddress({
      street: address.street || "",
      city: address.city || "",
      state: address.state || "",
      zip: address.zip || "",
      formatted: address.formatted,
      status: address.status,
      verified_at: address.verified_at,
      source: address.source,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addCardMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Credit Card</DialogTitle>
          <DialogDescription>
            Add a new credit card for payment processing
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cardNumber">Card Number</Label>
            <Input
              id="cardNumber"
              placeholder="1234 5678 9012 3456"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              maxLength={19}
              required
            />
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expiryMonth">Month</Label>
              <Select value={expiryMonth} onValueChange={setExpiryMonth} required>
                <SelectTrigger>
                  <SelectValue placeholder="MM" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0')).map((month) => (
                    <SelectItem key={month} value={month}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="expiryYear">Year</Label>
              <Select value={expiryYear} onValueChange={setExpiryYear} required>
                <SelectTrigger>
                  <SelectValue placeholder="YY" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() + i).toString().slice(-2)).map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="cvv">CVV</Label>
              <Input
                id="cvv"
                placeholder="123"
                value={cvv}
                onChange={(e) => setCvv(e.target.value)}
                maxLength={4}
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="cardholderName">Cardholder Name</Label>
            <Input
              id="cardholderName"
              placeholder="John Doe"
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value)}
              required
            />
          </div>
          
          <AddressInput
            value={billingAddress}
            onChange={handleAddressChange}
            label="Billing Address"
            required={true}
            autoValidate={true}
          />
          
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
            <ShieldCheck className="h-4 w-4 mt-0.5 text-green-600" />
            <p className="text-xs text-muted-foreground">
              Your card information is securely processed. We never store your full card number or CVV.
            </p>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addCardMutation.isPending}>
              {addCardMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Card
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
