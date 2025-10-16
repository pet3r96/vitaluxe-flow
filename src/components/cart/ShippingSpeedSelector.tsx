import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Truck, Clock, Zap } from "lucide-react";

interface ShippingSpeedSelectorProps {
  value: 'ground' | '2day' | 'overnight';
  onChange: (value: 'ground' | '2day' | 'overnight') => void;
  disabled?: boolean;
  patientName: string;
}

export const ShippingSpeedSelector = ({ 
  value, 
  onChange, 
  disabled = false,
  patientName 
}: ShippingSpeedSelectorProps) => {
  return (
    <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
      <Label className="text-sm font-semibold flex items-center gap-2">
        <Truck className="h-4 w-4" />
        Shipping Speed for {patientName}
      </Label>
      
      <RadioGroup value={value} onValueChange={onChange} disabled={disabled}>
        <div className="flex items-center space-x-2 p-3 rounded border hover:bg-accent/50 cursor-pointer">
          <RadioGroupItem value="ground" id={`ground-${patientName}`} />
          <Label 
            htmlFor={`ground-${patientName}`} 
            className="flex-1 cursor-pointer flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              Ground Shipping
            </span>
            <span className="text-sm text-muted-foreground">5-7 business days</span>
          </Label>
        </div>

        <div className="flex items-center space-x-2 p-3 rounded border hover:bg-accent/50 cursor-pointer">
          <RadioGroupItem value="2day" id={`2day-${patientName}`} />
          <Label 
            htmlFor={`2day-${patientName}`} 
            className="flex-1 cursor-pointer flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              2-Day Shipping
            </span>
            <span className="text-sm text-muted-foreground">2 business days</span>
          </Label>
        </div>

        <div className="flex items-center space-x-2 p-3 rounded border hover:bg-accent/50 cursor-pointer">
          <RadioGroupItem value="overnight" id={`overnight-${patientName}`} />
          <Label 
            htmlFor={`overnight-${patientName}`} 
            className="flex-1 cursor-pointer flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              Overnight Shipping
            </span>
            <span className="text-sm text-muted-foreground">Next business day</span>
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
};
