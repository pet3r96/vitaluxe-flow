import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, Percent, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const MerchantFeeSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [feePercentage, setFeePercentage] = useState<string>("3.75");

  // Fetch current setting
  const { data: currentSetting, isLoading } = useQuery({
    queryKey: ["merchant-fee-setting"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .eq("setting_key", "merchant_processing_fee_percentage")
        .single();

      if (error) throw error;
      
      const value = parseFloat(data.setting_value as string);
      setFeePercentage(value.toString());
      return data;
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (newPercentage: number) => {
      const { error } = await supabase
        .from("system_settings")
        .update({
          setting_value: newPercentage.toString(),
          updated_at: new Date().toISOString(),
        })
        .eq("setting_key", "merchant_processing_fee_percentage");

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-fee-setting"] });
      queryClient.invalidateQueries({ queryKey: ["merchant-fee-percentage"] });
      toast({
        title: "Fee Updated",
        description: "Merchant processing fee percentage has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const value = parseFloat(feePercentage);
    
    if (isNaN(value) || value < 0 || value > 100) {
      toast({
        title: "Invalid Percentage",
        description: "Please enter a valid percentage between 0 and 100.",
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate(value);
  };

  // Calculate example fee
  const exampleOrderTotal = 1000;
  const exampleShipping = 50;
  const exampleBase = exampleOrderTotal + exampleShipping;
  const exampleFee = (exampleBase * parseFloat(feePercentage || "0")) / 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Merchant Processing Fee
        </CardTitle>
        <CardDescription>
          Configure the merchant processing fee percentage applied to all orders
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Percent className="h-4 w-4" />
          <AlertDescription>
            The merchant processing fee is calculated as: 
            <strong> (Subtotal + Shipping) × Fee Percentage</strong>
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="fee-percentage">Fee Percentage</Label>
          <div className="flex gap-2">
            <Input
              id="fee-percentage"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={feePercentage}
              onChange={(e) => setFeePercentage(e.target.value)}
              placeholder="3.75"
            />
            <Button 
              onClick={handleSave}
              disabled={updateMutation.isPending || isLoading}
            >
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Current: {currentSetting?.setting_value?.toString() || "3.75"}%
          </p>
        </div>

        <div className="rounded-lg bg-muted p-4 space-y-2">
          <h4 className="text-sm font-semibold">Example Calculation</h4>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span>Order Subtotal:</span>
              <span className="font-mono">${exampleOrderTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping:</span>
              <span className="font-mono">+ ${exampleShipping.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t pt-1">
              <span>Base Amount:</span>
              <span className="font-mono">${exampleBase.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-primary">
              <span>Merchant Fee ({feePercentage}%):</span>
              <span className="font-mono font-semibold">${exampleFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 font-bold">
              <span>Grand Total:</span>
              <span className="font-mono">${(exampleBase + exampleFee).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <Alert>
          <AlertDescription className="text-xs">
            <strong>Note:</strong> Changes to this percentage will apply to all new orders immediately. 
            Existing orders retain the fee percentage that was active at the time of purchase.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};
