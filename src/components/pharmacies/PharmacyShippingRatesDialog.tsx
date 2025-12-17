import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Truck, Clock, Zap, AlertCircle } from "lucide-react";

interface PharmacyShippingRatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pharmacy: { id: string; name: string };
}

// VIOS service code mapping
const VIOS_SERVICE_CODES: Record<string, { code: number; label: string }> = {
  'ground': { code: 1, label: 'Ground (1)' },
  '2day': { code: 2, label: '2-Day (2)' },
  'overnight': { code: 3, label: 'Overnight (3)' }
};

export const PharmacyShippingRatesDialog = ({ 
  open, 
  onOpenChange, 
  pharmacy 
}: PharmacyShippingRatesDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [rates, setRates] = useState({
    ground: { rate: '', enabled: true, vios_service_code: 1 },
    '2day': { rate: '', enabled: true, vios_service_code: 2 },
    overnight: { rate: '', enabled: true, vios_service_code: 3 }
  });

  // Fetch pharmacy details to check if it's VIOS
  const { data: pharmacyDetails } = useQuery({
    queryKey: ['pharmacy-details', pharmacy.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pharmacies')
        .select('api_handler_type')
        .eq('id', pharmacy.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open
  });

  const isViosPharmacy = pharmacyDetails?.api_handler_type === 'vios';

  // Fetch existing rates
  const { data: existingRates } = useQuery({
    queryKey: ['pharmacy-shipping-rates', pharmacy.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pharmacy_shipping_rates')
        .select('shipping_speed, rate, enabled, vios_service_code')
        .eq('pharmacy_id', pharmacy.id);
      
      if (error) throw error;
      return data;
    },
    enabled: open
  });

  useEffect(() => {
    if (existingRates) {
      const ratesMap = existingRates.reduce((acc, rate) => {
        acc[rate.shipping_speed] = {
          rate: rate.rate.toString(),
          enabled: rate.enabled ?? true,
          vios_service_code: rate.vios_service_code ?? VIOS_SERVICE_CODES[rate.shipping_speed]?.code ?? 1
        };
        return acc;
      }, { 
        ground: { rate: '', enabled: true, vios_service_code: 1 }, 
        '2day': { rate: '', enabled: true, vios_service_code: 2 }, 
        overnight: { rate: '', enabled: true, vios_service_code: 3 } 
      });
      setRates(ratesMap);
    }
  }, [existingRates]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      console.log('[PharmacyShippingRatesDialog] Starting save...', {
        pharmacyId: pharmacy.id,
        pharmacyName: pharmacy.name,
        rates,
        timestamp: new Date().toISOString()
      });

      const updates: Array<{
        pharmacy_id: string;
        shipping_speed: 'ground' | '2day' | 'overnight';
        rate: number;
        enabled: boolean;
        vios_service_code: number | null;
      }> = [];

      for (const [speedKey, config] of Object.entries(rates)) {
        const speed = speedKey as 'ground' | '2day' | 'overnight';
        const parsed = parseFloat(config.rate);
        const hasValidNumber = Number.isFinite(parsed) && parsed >= 0;

        if (config.enabled) {
          if (!hasValidNumber) {
            // Block save when an enabled option has no valid price
            throw new Error(
              `Please enter a valid price for ${
                speed === 'ground' ? 'Ground' : speed === '2day' ? '2-Day' : 'Overnight'
              } or disable it.`
            );
          }

          updates.push({
            pharmacy_id: pharmacy.id,
            shipping_speed: speed,
            rate: parsed,
            enabled: true,
            vios_service_code: isViosPharmacy ? config.vios_service_code : null,
          });
        } else {
          // Persist disabled options with rate = 0
          updates.push({
            pharmacy_id: pharmacy.id,
            shipping_speed: speed,
            rate: 0,
            enabled: false,
            vios_service_code: isViosPharmacy ? config.vios_service_code : null,
          });
        }
      }

      console.log('[PharmacyShippingRatesDialog] Upserting rates:', updates);

      // Upsert rates for all speeds and return data to verify what was saved
      const { data, error } = await supabase
        .from('pharmacy_shipping_rates')
        .upsert(updates, { onConflict: 'pharmacy_id,shipping_speed' })
        .select();

      if (error) {
        console.error('[PharmacyShippingRatesDialog] Save FAILED:', {
          error,
          errorCode: error.code,
          errorMessage: error.message,
          errorDetails: error.details,
          updates,
          pharmacyId: pharmacy.id,
          timestamp: new Date().toISOString()
        });
        throw new Error(`Failed to save shipping rates: ${error.message} (${error.code || 'unknown'})`);
      }

      console.log('[PharmacyShippingRatesDialog] Save SUCCESS:', data);
      return data;
    },
    onSuccess: (data) => {
      console.log('[PharmacyShippingRatesDialog] Saved data:', data);
      toast({
        title: "Shipping Rates Updated",
        description: `Updated ${data.length} shipping options for ${pharmacy.name}`
      });
      
      // Invalidate ALL related queries to ensure cache is fully refreshed
      queryClient.invalidateQueries({ queryKey: ['pharmacies'] });
      queryClient.invalidateQueries({ queryKey: ['pharmacy-shipping-rates'] });
      queryClient.invalidateQueries({ queryKey: ['multiple-pharmacy-shipping-rates'] });
      queryClient.invalidateQueries({ queryKey: ['pharmacy-shipping-rates-map'] });
      queryClient.invalidateQueries({ queryKey: ['pharmacy-enabled-rates'] });
      
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
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure Shipping Rates - {pharmacy.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isViosPharmacy && (
            <Alert className="border-blue-500/50 bg-blue-500/10">
              <AlertCircle className="h-4 w-4 text-blue-500" />
              <AlertDescription className="text-sm">
                <strong>VIOS API Integration</strong>
                <p className="text-xs mt-1 text-muted-foreground">
                  VIOS service codes: Ground=1, 2-Day=2, Overnight=3 (requires VIOS account config)
                </p>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="ground" className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Ground Shipping (5-7 days)
                {isViosPharmacy && (
                  <Badge variant="secondary" className="text-xs">Code: {rates.ground.vios_service_code}</Badge>
                )}
              </Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={rates.ground.enabled}
                  onCheckedChange={(checked) => 
                    setRates({ ...rates, ground: { ...rates.ground, enabled: !!checked }})
                  }
                />
                <span className="text-xs text-muted-foreground">
                  {rates.ground.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
            <Input
              id="ground"
              type="number"
              step="0.01"
              min="0"
              placeholder="9.99"
              value={rates.ground.rate}
              onChange={(e) => setRates({ ...rates, ground: { ...rates.ground, rate: e.target.value }})}
              disabled={!rates.ground.enabled}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="2day" className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                2-Day Shipping
                {isViosPharmacy && (
                  <Badge variant="secondary" className="text-xs">Code: {rates['2day'].vios_service_code}</Badge>
                )}
              </Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={rates['2day'].enabled}
                  onCheckedChange={(checked) => 
                    setRates({ ...rates, '2day': { ...rates['2day'], enabled: !!checked }})
                  }
                />
                <span className="text-xs text-muted-foreground">
                  {rates['2day'].enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
            <Input
              id="2day"
              type="number"
              step="0.01"
              min="0"
              placeholder="19.99"
              value={rates['2day'].rate}
              onChange={(e) => setRates({ ...rates, '2day': { ...rates['2day'], rate: e.target.value }})}
              disabled={!rates['2day'].enabled}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="overnight" className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                Overnight Shipping
                {isViosPharmacy && (
                  <Badge variant="secondary" className="text-xs">Code: {rates.overnight.vios_service_code}</Badge>
                )}
              </Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={rates.overnight.enabled}
                  onCheckedChange={(checked) => 
                    setRates({ ...rates, overnight: { ...rates.overnight, enabled: !!checked }})
                  }
                />
                <span className="text-xs text-muted-foreground">
                  {rates.overnight.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
            {isViosPharmacy && !rates.overnight.enabled && (
              <p className="text-xs text-amber-600">
                Note: Overnight shipping (code 3) must be enabled by your VIOS representative
              </p>
            )}
            <Input
              id="overnight"
              type="number"
              step="0.01"
              min="0"
              placeholder="29.99"
              value={rates.overnight.rate}
              onChange={(e) => setRates({ ...rates, overnight: { ...rates.overnight, rate: e.target.value }})}
              disabled={!rates.overnight.enabled}
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
