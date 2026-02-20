import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Zap, Clock, Truck, Package } from "lucide-react";

interface PharmacyShippingRatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pharmacy: { id: string; name: string };
}

type ShippingSpeed = 'overnight' | '2day' | 'priority' | 'first_class';

const SHIPPING_OPTIONS: Array<{ key: ShippingSpeed; label: string; icon: any; iconColor: string; placeholder: string }> = [
  { key: 'overnight', label: 'Overnight Shipping', icon: Zap, iconColor: 'text-yellow-500', placeholder: '29.99' },
  { key: '2day', label: '2-Day Shipping', icon: Clock, iconColor: 'text-blue-500', placeholder: '19.99' },
  { key: 'priority', label: 'Priority Shipping (2-3 days)', icon: Truck, iconColor: 'text-green-600', placeholder: '14.99' },
  { key: 'first_class', label: 'First Class (3-5 days)', icon: Package, iconColor: '', placeholder: '9.99' },
];

export const PharmacyShippingRatesDialog = ({ 
  open, 
  onOpenChange, 
  pharmacy 
}: PharmacyShippingRatesDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [rates, setRates] = useState<Record<ShippingSpeed, { rate: string; enabled: boolean }>>({
    overnight: { rate: '', enabled: true },
    '2day': { rate: '', enabled: true },
    priority: { rate: '', enabled: true },
    first_class: { rate: '', enabled: true },
  });

  const { data: existingRates } = useQuery({
    queryKey: ['pharmacy-shipping-rates', pharmacy.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pharmacy_shipping_rates')
        .select('shipping_speed, rate, enabled')
        .eq('pharmacy_id', pharmacy.id);
      
      if (error) throw error;
      return data;
    },
    enabled: open
  });

  useEffect(() => {
    if (existingRates) {
      const ratesMap = existingRates.reduce((acc, rate) => {
        acc[rate.shipping_speed as ShippingSpeed] = {
          rate: rate.rate.toString(),
          enabled: rate.enabled ?? true
        };
        return acc;
      }, { 
        overnight: { rate: '', enabled: true },
        '2day': { rate: '', enabled: true }, 
        priority: { rate: '', enabled: true },
        first_class: { rate: '', enabled: true },
      } as Record<ShippingSpeed, { rate: string; enabled: boolean }>);
      setRates(ratesMap);
    }
  }, [existingRates]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates: Array<{
        pharmacy_id: string;
        shipping_speed: ShippingSpeed;
        rate: number;
        enabled: boolean;
      }> = [];

      for (const [speedKey, config] of Object.entries(rates)) {
        const speed = speedKey as ShippingSpeed;
        const parsed = parseFloat(config.rate);
        const hasValidNumber = Number.isFinite(parsed) && parsed >= 0;

        const label = SHIPPING_OPTIONS.find(o => o.key === speed)?.label || speed;

        if (config.enabled) {
          if (!hasValidNumber) {
            throw new Error(`Please enter a valid price for ${label} or disable it.`);
          }
          updates.push({ pharmacy_id: pharmacy.id, shipping_speed: speed, rate: parsed, enabled: true });
        } else {
          updates.push({ pharmacy_id: pharmacy.id, shipping_speed: speed, rate: 0, enabled: false });
        }
      }

      const { data, error } = await supabase
        .from('pharmacy_shipping_rates')
        .upsert(updates, { onConflict: 'pharmacy_id,shipping_speed' })
        .select();

      if (error) throw new Error(`Failed to save shipping rates: ${error.message}`);
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Shipping Rates Updated", description: `Updated ${data.length} shipping options for ${pharmacy.name}` });
      queryClient.invalidateQueries({ queryKey: ['pharmacies'] });
      queryClient.invalidateQueries({ queryKey: ['pharmacy-shipping-rates'] });
      queryClient.invalidateQueries({ queryKey: ['multiple-pharmacy-shipping-rates'] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure Shipping Rates - {pharmacy.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {SHIPPING_OPTIONS.map(({ key, label, icon: Icon, iconColor, placeholder }) => (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={key} className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${iconColor}`} /> {label}
                </Label>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    checked={rates[key].enabled} 
                    onCheckedChange={(checked) => setRates({ ...rates, [key]: { ...rates[key], enabled: !!checked }})} 
                  />
                  <span className="text-xs text-muted-foreground">{rates[key].enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>
              <Input 
                id={key} 
                type="number" 
                step="0.01" 
                min="0" 
                placeholder={placeholder} 
                value={rates[key].rate} 
                onChange={(e) => setRates({ ...rates, [key]: { ...rates[key], rate: e.target.value }})} 
                disabled={!rates[key].enabled} 
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : "Save Rates"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
