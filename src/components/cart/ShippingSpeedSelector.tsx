import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Truck, Clock, Zap, Package } from "lucide-react";
import { memo, useMemo, useCallback } from "react";

export type ShippingSpeed = 'overnight' | '2day' | 'priority' | 'first_class';

interface ShippingSpeedSelectorProps {
  value: ShippingSpeed;
  onChange: (value: ShippingSpeed) => void;
  disabled?: boolean;
  patientName: string;
  enabledOptions?: ShippingSpeed[];
  isLoading?: boolean;
  rates?: Record<string, number>;
}

export const ShippingSpeedSelector = memo(({ 
  value, 
  onChange, 
  disabled = false,
  patientName,
  enabledOptions,
  isLoading = false,
  rates
}: ShippingSpeedSelectorProps) => {
  
  const allOptions = useMemo(() => [
    { value: 'overnight' as const, icon: Zap, label: 'Overnight Shipping', desc: '(Next business day)', iconColor: 'text-yellow-500' },
    { value: '2day' as const, icon: Clock, label: '2-Day Shipping', desc: '(2 business days)', iconColor: 'text-blue-500' },
    { value: 'priority' as const, icon: Truck, label: 'Priority Shipping', desc: '(2-3 business days)', iconColor: 'text-green-600' },
    { value: 'first_class' as const, icon: Package, label: 'First Class', desc: '(3-5 business days)', iconColor: 'text-muted-foreground' },
  ], []);

  const formatRate = useCallback((speed: string) => {
    if (!rates || !rates[speed]) return '';
    return ` - $${rates[speed].toFixed(2)}`;
  }, [rates]);

  const visibleOptions = useMemo(() => 
    enabledOptions 
      ? allOptions.filter(opt => enabledOptions.includes(opt.value))
      : allOptions,
    [allOptions, enabledOptions]
  );

  const handleChange = useCallback((newValue: string) => {
    onChange(newValue as ShippingSpeed);
  }, [onChange]);

  if (isLoading) {
    return (
      <div className="space-y-1.5 p-3 border rounded-lg bg-muted/30">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <Truck className="h-4 w-4" />
          Shipping for {patientName}
        </Label>
        <div className="p-3 text-sm text-muted-foreground">Loading shipping options...</div>
      </div>
    );
  }

  if (visibleOptions.length === 0) {
    return (
      <div className="space-y-1.5 p-3 border rounded-lg bg-destructive/10">
        <Label className="text-sm font-semibold flex items-center gap-2 text-destructive">
          <Truck className="h-4 w-4" />
          No Shipping Available
        </Label>
        <div className="p-3 text-sm text-destructive">
          No shipping options are available for this pharmacy. Please contact support.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 p-3 border rounded-lg bg-muted/30">
      <Label className="text-sm font-semibold flex items-center gap-2">
        <Truck className="h-4 w-4" />
        Shipping for {patientName}
      </Label>
      
      <RadioGroup value={value} onValueChange={handleChange} disabled={disabled}>
        {visibleOptions.map((option) => {
          const Icon = option.icon;
          
          return (
            <div 
              key={option.value}
              className="flex items-center space-x-2 p-2 rounded border hover:bg-accent/50 cursor-pointer"
            >
              <RadioGroupItem value={option.value} id={`${option.value}-${patientName}`} />
              <Label 
                htmlFor={`${option.value}-${patientName}`} 
                className="flex-1 cursor-pointer flex items-center gap-2"
              >
                <Icon className={`h-4 w-4 ${option.iconColor}`} />
                <div>
                  <div className="font-medium">{option.label}{formatRate(option.value)}</div>
                  <div className="text-xs text-muted-foreground">{option.desc}</div>
                </div>
              </Label>
            </div>
          );
        })}
      </RadioGroup>
    </div>
  );
});

ShippingSpeedSelector.displayName = "ShippingSpeedSelector";
