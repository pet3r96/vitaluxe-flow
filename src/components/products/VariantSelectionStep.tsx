import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { ProductVariant } from "@/types/domain/productVariant";

interface VariantSelectionStepProps {
  variants: ProductVariant[];
  selectedVariantId: string | null;
  onSelect: (variantId: string) => void;
}

export function VariantSelectionStep({
  variants,
  selectedVariantId,
  onSelect,
}: VariantSelectionStepProps) {
  const formatPrice = (price: number | null | undefined) => {
    if (price == null) return '-';
    return `$${Number(price).toFixed(2)}`;
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-semibold">Select Dosage</Label>
        <p className="text-sm text-muted-foreground">
          Choose the dosage option for this order
        </p>
      </div>

      <RadioGroup
        value={selectedVariantId || undefined}
        onValueChange={onSelect}
        className="space-y-3"
      >
        {variants.map((variant) => (
          <div
            key={variant.id}
            className={`
              flex items-center space-x-3 p-4 border rounded-lg cursor-pointer
              transition-colors hover:bg-accent/50
              ${selectedVariantId === variant.id ? 'border-primary bg-primary/5' : 'border-border'}
            `}
            onClick={() => onSelect(variant.id)}
          >
            <RadioGroupItem value={variant.id} id={variant.id} />
            <div className="flex-1">
              <Label
                htmlFor={variant.id}
                className="text-base font-medium cursor-pointer"
              >
                {variant.dosage_label}
              </Label>
            </div>
            <Badge variant="secondary" className="text-base font-semibold">
              {formatPrice(variant.retail_price ?? variant.base_price)}
            </Badge>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
