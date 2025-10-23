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
import { BillingAddress } from "@/types/payment";
import { AddressInput } from "@/components/ui/address-input";

interface AddBankAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultBillingAddress?: Partial<BillingAddress>;
  onSuccess?: () => void;
  practiceId?: string;
}

export const AddBankAccountDialog = ({ 
  open, 
  onOpenChange,
  defaultBillingAddress,
  onSuccess,
  practiceId
}: AddBankAccountDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [routingNumber, setRoutingNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState<'checking' | 'savings'>('checking');
  const [bankName, setBankName] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [billingAddress, setBillingAddress] = useState<BillingAddress>({
    street: defaultBillingAddress?.street || "",
    city: defaultBillingAddress?.city || "",
    state: defaultBillingAddress?.state || "",
    zip: defaultBillingAddress?.zip || "",
  });

  const addBankMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('authorizenet-create-customer-profile', {
        body: {
          payment_type: 'bank_account',
          routing_number: routingNumber,
          account_number: accountNumber,
          account_type: accountType,
          bank_name: bankName,
          account_holder_name: accountHolderName,
          billing_address: billingAddress,
          is_default: false,
          practice_id: practiceId,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.message || 'Failed to add bank account');
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods', practiceId] });
      queryClient.refetchQueries({ queryKey: ['payment-methods', practiceId] });
      toast({
        title: "Bank Account Added",
        description: "Your bank account has been added successfully.",
      });
      onOpenChange(false);
      resetForm();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add bank account",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setRoutingNumber("");
    setAccountNumber("");
    setAccountType('checking');
    setBankName("");
    setAccountHolderName("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addBankMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Bank Account (ACH/eCheck)</DialogTitle>
          <DialogDescription>
            Add a bank account for direct debit payments
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bankName">Bank Name</Label>
            <Input
              id="bankName"
              placeholder="Bank of America"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="accountHolderName">Account Holder Name</Label>
            <Input
              id="accountHolderName"
              placeholder="John Doe"
              value={accountHolderName}
              onChange={(e) => setAccountHolderName(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="routingNumber">Routing Number</Label>
            <Input
              id="routingNumber"
              placeholder="123456789"
              value={routingNumber}
              onChange={(e) => setRoutingNumber(e.target.value)}
              maxLength={9}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="accountNumber">Account Number</Label>
            <Input
              id="accountNumber"
              placeholder="1234567890"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="accountType">Account Type</Label>
            <Select value={accountType} onValueChange={(value: any) => setAccountType(value)} required>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checking">Checking</SelectItem>
                <SelectItem value="savings">Savings</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <AddressInput
            value={billingAddress}
            onChange={(addr) => setBillingAddress({
              street: addr.street || "",
              city: addr.city || "",
              state: addr.state || "",
              zip: addr.zip || "",
            })}
            label="Billing Address"
            required
            autoValidate={true}
          />
          
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
            <ShieldCheck className="h-4 w-4 mt-0.5 text-green-600" />
            <p className="text-xs text-muted-foreground">
              Your bank account information is securely encrypted. We never store your full account number.
            </p>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addBankMutation.isPending}>
              {addBankMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Bank Account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
