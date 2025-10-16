import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Truck, Clock, Zap } from "lucide-react";

interface PharmacyShippingRatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pharmacy: { id: string; name: string };
}

export const PharmacyShippingRatesDialog = ({ 
  open, 
  onOpenChange, 
  pharmacy 
}: PharmacyShippingRatesDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [rates, setRates] = useState({
    ground: '',
    '2day': '',
    overnight: ''
  });

  // Fetch existing rates
  const { data: existingRates } = useQuery({
    queryKey: ['pharmacy-shipping-rates', pharmacy.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pharmacy_shipping_rates')
        .select('shipping_speed, rate')
        .eq('pharmacy_id', pharmacy.id);
      
      if (error) throw error;
      return data;
    },
    enabled: open
  });

  useEffect(() => {
    if (existingRates) {
      const ratesMap = existingRates.reduce((acc, rate) => {
        acc[rate.shipping_speed] = rate.rate.toString();
        return acc;
      }, { ground: '', '2day': '', overnight: '' });
      setRates(ratesMap);
    }
  }, [existingRates]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = [];
      
      for (const [speed, rate] of Object.entries(rates)) {
        if (rate && parseFloat(rate) >= 0) {
          updates.push({
            pharmacy_id: pharmacy.id,
            shipping_speed: speed,
            rate: parseFloat(rate)
          });
        }
      }

      // Upsert rates
      const { error } = await supabase
        .from('pharmacy_shipping_rates')
        .upsert(updates, { onConflict: 'pharmacy_id,shipping_speed' });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Shipping Rates Updated",
        description: "Pharmacy shipping rates have been saved successfully."
      });
      queryClient.invalidateQueries({ queryKey: ['pharmacies'] });
      queryClient.invalidateQueries({ queryKey: ['pharmacy-shipping-rates'] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure Shipping Rates - {pharmacy.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="ground" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Ground Shipping (5-7 days)
            </Label>
            <Input
              id="ground"
              type="number"
              step="0.01"
              min="0"
              placeholder="9.99"
              value={rates.ground}
              onChange={(e) => setRates({ ...rates, ground: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="2day" className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              2-Day Shipping
            </Label>
            <Input
              id="2day"
              type="number"
              step="0.01"
              min="0"
              placeholder="19.99"
              value={rates['2day']}
              onChange={(e) => setRates({ ...rates, '2day': e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="overnight" className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              Overnight Shipping
            </Label>
            <Input
              id="overnight"
              type="number"
              step="0.01"
              min="0"
              placeholder="29.99"
              value={rates.overnight}
              onChange={(e) => setRates({ ...rates, overnight: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : "Save Rates"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
