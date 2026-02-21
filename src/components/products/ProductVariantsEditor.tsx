import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductVariantFormData } from "@/types/domain/productVariant";
import { createEmptyVariant } from "@/types/domain/productVariant";
import { ViosProductSearch } from "./ViosProductSearch";

interface ProductVariantsEditorProps {
  variants: ProductVariantFormData[];
  onChange: (variants: ProductVariantFormData[]) => void;
  requiresPrescription: boolean;
  disabled?: boolean;
}

export function ProductVariantsEditor({
  variants,
  onChange,
  requiresPrescription,
  disabled = false,
}: ProductVariantsEditorProps) {
  const activeVariants = variants.filter(v => !v.toDelete);

  const handleAdd = () => {
    onChange([...variants, createEmptyVariant()]);
  };

  const handleRemove = (index: number) => {
    const variant = activeVariants[index];
    const realIndex = variants.findIndex(v => v === variant);
    
    if (variant.id && !variant.isNew) {
      // Mark for deletion
      const updated = [...variants];
      updated[realIndex] = { ...variant, toDelete: true };
      onChange(updated);
    } else {
      // Remove from array (new, unsaved variant)
      onChange(variants.filter((_, i) => i !== realIndex));
    }
  };

  const handleUpdate = (index: number, field: keyof ProductVariantFormData, value: any) => {
    const variant = activeVariants[index];
    const realIndex = variants.findIndex(v => v === variant);
    const updated = [...variants];
    updated[realIndex] = { ...variant, [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-semibold">Dosage Variants</Label>
          <p className="text-xs text-muted-foreground">
            Add multiple dosage options with different prices
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={disabled}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Variant
        </Button>
      </div>

      {activeVariants.length === 0 ? (
        <div className="border-2 border-dashed rounded-lg p-6 text-center text-muted-foreground">
          <p className="text-sm">No dosage variants defined.</p>
          <p className="text-xs mt-1">Click "Add Variant" to create dosage options with different prices.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeVariants.map((variant, index) => (
            <div
              key={variant.id || `new-${index}`}
              className={cn(
                "border rounded-lg p-4 space-y-3",
                !variant.active && "opacity-60 bg-muted/50"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="text-muted-foreground pt-2">
                  <GripVertical className="h-4 w-4" />
                </div>
                
                <div className="flex-1 grid grid-cols-2 gap-3">
                  {/* Dosage Label */}
                  <div className="col-span-2 sm:col-span-1">
                    <Label className="text-xs">Dosage Label *</Label>
                    <Input
                      value={variant.dosage_label}
                      onChange={(e) => handleUpdate(index, 'dosage_label', e.target.value)}
                      placeholder="e.g., 2.5mg, 5mg, 10mg"
                      disabled={disabled}
                      className="mt-1"
                    />
                  </div>
                  
                  {/* Product Code (VIOS Med ID) */}
                  <div className="col-span-2 sm:col-span-1">
                    <Label className="text-xs">VIOS Product Code</Label>
                    <div className="mt-1">
                      <ViosProductSearch
                        value={variant.product_code || ''}
                        onChange={(medId) => handleUpdate(index, 'product_code', medId)}
                        disabled={disabled}
                        placeholder="Search VIOS catalog..."
                      />
                    </div>
                  </div>
                  
                  {/* Base Price */}
                  <div className="col-span-2 sm:col-span-1">
                    <Label className="text-xs">Base Price *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={variant.base_price}
                      onChange={(e) => handleUpdate(index, 'base_price', e.target.value)}
                      placeholder="0.00"
                      disabled={disabled}
                      className="mt-1"
                    />
                  </div>

                  {/* Topline Price - hide for Rx */}
                  {!requiresPrescription && (
                    <div>
                      <Label className="text-xs">Topline Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={variant.topline_price}
                        onChange={(e) => handleUpdate(index, 'topline_price', e.target.value)}
                        placeholder="0.00"
                        disabled={disabled}
                        className="mt-1"
                      />
                    </div>
                  )}

                  {/* Downline Price - hide for Rx */}
                  {!requiresPrescription && (
                    <div>
                      <Label className="text-xs">Downline Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={variant.downline_price}
                        onChange={(e) => handleUpdate(index, 'downline_price', e.target.value)}
                        placeholder="0.00"
                        disabled={disabled}
                        className="mt-1"
                      />
                    </div>
                  )}

                  {/* Retail/Practice Price */}
                  <div>
                    <Label className="text-xs">Practice Price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={variant.retail_price}
                      onChange={(e) => handleUpdate(index, 'retail_price', e.target.value)}
                      placeholder="0.00"
                      disabled={disabled}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2 pt-2">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs">Active</Label>
                    <Switch
                      checked={variant.active}
                      onCheckedChange={(checked) => handleUpdate(index, 'active', checked)}
                      disabled={disabled}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(index)}
                    disabled={disabled || activeVariants.length <= 1}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeVariants.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {activeVariants.length} variant{activeVariants.length !== 1 ? 's' : ''} defined.
          {activeVariants.length > 1 && " Users will be prompted to select a dosage when adding to cart."}
        </p>
      )}
    </div>
  );
}
