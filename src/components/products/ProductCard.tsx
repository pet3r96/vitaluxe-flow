import { memo } from "react";
import { usePracticeRxPrivileges } from "@/hooks/usePracticeRxPrivileges";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ShoppingCart, Edit, Trash2, MoreVertical, Lock } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface EffectivePriceData {
  product_id: string;
  effective_topline_price: number | null;
  effective_downline_price: number | null;
  effective_retail_price: number | null;
  base_price: number | null;
  has_override: boolean;
}

interface ProductCardProps {
  product: any;
  variantStats?: any;
  effectivePrice?: EffectivePriceData | null;
  isAdmin: boolean;
  isProvider: boolean;
  isToplineRep: boolean;
  isDownlineRep: boolean;
  role: string | null;
  canOrder: boolean;
  isHiddenFromDownline?: boolean;
  onEdit: (product: any) => void;
  onDelete: (product: any) => void;
  onAddToCart: (product: any) => void;
  onToggleStatus: (productId: string, currentStatus: boolean) => void;
}

export const ProductCard = memo(({
  product,
  variantStats,
  effectivePrice,
  isAdmin,
  isProvider,
  isToplineRep,
  isDownlineRep,
  role,
  canOrder,
  isHiddenFromDownline,
  onEdit,
  onDelete,
  onAddToCart,
  onToggleStatus,
}: ProductCardProps) => {
  const { canOrderRx } = usePracticeRxPrivileges();

  if (!product) {
    import('@/lib/logger').then(({ logger }) => {
      logger.error('ProductCard received null product', { role, canOrder });
    });
    return null;
  }

  // Helper to format prices consistently
  const formatPrice = (value: any) => {
    if (value == null) return '-';
    return Number(value).toFixed(2);
  };

  // Get variant stats from prop (passed from ProductsGrid)
  const variantCount = variantStats?.variant_count || 0;
  const hasVariants = variantCount > 0;
  const hasMultipleVariants = variantCount > 1;

  // Helper to format price range
  const formatPriceRange = (minPrice: number | null, maxPrice: number | null, fallbackPrice: number | null) => {
    const min = minPrice ?? fallbackPrice;
    const max = maxPrice ?? fallbackPrice;
    if (min == null || max == null) return `$${formatPrice(fallbackPrice)}`;
    if (min === max || Math.abs(min - max) < 0.01) return `$${formatPrice(min)}`;
    return `$${formatPrice(min)} - $${formatPrice(max)}`;
  };

  const getPriceDisplay = () => {
    if (isAdmin) {
      // For single-variant products, prioritize variantStats prices over product-level prices
      // This fixes the issue where product-level prices are NULL but variant prices exist
      const singleVariantBasePrice = variantStats?.min_base_price ?? product.base_price;
      const singleVariantToplinePrice = variantStats?.min_topline_price ?? product.topline_price;
      const singleVariantDownlinePrice = variantStats?.min_downline_price ?? product.downline_price;
      const singleVariantRetailPrice = variantStats?.min_retail_price ?? product.retail_price;
      
      return (
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground pr-2">Base:</span>
            <span className="font-semibold">
              {hasMultipleVariants 
                ? formatPriceRange(variantStats?.min_base_price, variantStats?.max_base_price, product.base_price)
                : `$${formatPrice(singleVariantBasePrice)}`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground pr-2">Topline:</span>
            <span>
              {product.requires_prescription ? "$-" : (
                hasMultipleVariants 
                  ? formatPriceRange(variantStats?.min_topline_price, variantStats?.max_topline_price, product.topline_price)
                  : `$${formatPrice(singleVariantToplinePrice)}`
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground pr-2">Downline:</span>
            <span>
              {product.requires_prescription ? "$-" : (
                hasMultipleVariants 
                  ? formatPriceRange(variantStats?.min_downline_price, variantStats?.max_downline_price, product.downline_price)
                  : `$${formatPrice(singleVariantDownlinePrice)}`
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground pr-2">Practice:</span>
            <span>
              {hasMultipleVariants 
                ? formatPriceRange(variantStats?.min_retail_price, variantStats?.max_retail_price, product.retail_price)
                : `$${formatPrice(singleVariantRetailPrice)}`}
            </span>
          </div>
        </div>
      );
    }

    if (isToplineRep) {
      // Don't show "Your Price" for RX products - no commission on prescriptions
      if (product.requires_prescription) {
        return (
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Practice Price:</span>
              <span className="font-bold text-primary text-lg">
                ${formatPrice(effectivePrice?.effective_retail_price ?? product.retail_price)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground italic">
              Prescription products: no rep commission
            </p>
          </div>
        );
      }
      
      // Show both prices for non-RX products
      return (
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Your Price:</span>
            <span className="font-bold text-primary text-lg">
              ${formatPrice(effectivePrice?.effective_topline_price ?? product.topline_price)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Practice Price:</span>
            <span>${formatPrice(effectivePrice?.effective_retail_price ?? product.retail_price)}</span>
          </div>
        </div>
      );
    }

    if (isDownlineRep) {
      // Don't show "Your Price" for RX products - no commission on prescriptions
      if (product.requires_prescription) {
        return (
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Practice Price:</span>
              <span className="font-bold text-primary text-lg">
                ${formatPrice(effectivePrice?.effective_retail_price ?? product.retail_price)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground italic">
              Prescription products: no rep commission
            </p>
          </div>
        );
      }
      
      // Show both prices for non-RX products
      return (
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Your Price:</span>
            <span className="font-bold text-primary text-lg">
              ${formatPrice(effectivePrice?.effective_downline_price ?? product.downline_price)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Practice Price:</span>
            <span>${formatPrice(effectivePrice?.effective_retail_price ?? product.retail_price)}</span>
          </div>
        </div>
      );
    }

    if (isProvider) {
      const priceDisplay = hasMultipleVariants 
        ? formatPriceRange(variantStats?.min_retail_price, variantStats?.max_retail_price, product.retail_price)
        : `$${formatPrice(effectivePrice?.effective_retail_price ?? product.retail_price ?? product.base_price)}`;
      
      return (
        <div className="text-center">
          <div className="text-3xl font-bold text-primary">
            {priceDisplay}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 flex flex-col h-full">
      <CardContent className="p-4 sm:p-5 lg:p-6 flex-1 flex flex-col">
        {/* Product Image */}
        <div className="aspect-[4/3] mb-3 sm:mb-4 rounded-lg overflow-hidden bg-muted flex items-center justify-center p-2">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
              No image
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-3 flex flex-col items-start flex-1">
          <div className="w-full space-y-1">
            <h3 className="font-semibold text-base sm:text-lg lg:text-xl line-clamp-2 leading-tight">{product.name}</h3>
            {hasMultipleVariants ? (
              <p className="text-sm text-muted-foreground line-clamp-1">Multiple options available</p>
            ) : product.dosage ? (
              <p className="text-sm text-muted-foreground line-clamp-1">{product.dosage}</p>
            ) : variantStats?.first_variant_dosage ? (
              <p className="text-sm text-muted-foreground line-clamp-1">{variantStats.first_variant_dosage}</p>
            ) : null}
            {product.description && (
              <div className="flex items-start gap-1">
                <span className="text-xs font-semibold text-muted-foreground shrink-0">Description:</span>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-sm text-muted-foreground line-clamp-2 cursor-help hover:text-foreground transition-colors">
                        {product.description}
                      </p>
                    </TooltipTrigger>
                    <TooltipContent 
                      className="max-w-xs sm:max-w-sm md:max-w-md p-3" 
                      side="top"
                      align="start"
                    >
                      <div className="space-y-1">
                        <p className="text-xs font-semibold">Full Description:</p>
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {product.description}
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2 w-full">
            {product.requires_prescription && (
              <Badge variant="secondary" size="sm" className="text-xs">
                Rx Required
              </Badge>
            )}
            {product.dosage_form && (
              <Badge variant="outline" size="sm" className="text-xs">
                {product.dosage_form}
              </Badge>
            )}
            {product.product_types?.name && (
              <Badge variant="secondary" size="sm" className="text-xs">{product.product_types.name}</Badge>
            )}
            <Badge variant={product.active ? "success" : "outline"} size="sm" className="text-xs">
              {product.active ? "Active" : "Inactive"}
            </Badge>
            {isToplineRep && isHiddenFromDownline && (
              <Badge variant="destructive" size="sm" className="text-xs">
                Deactivated
              </Badge>
            )}
            {effectivePrice?.has_override && (isToplineRep || isDownlineRep || isProvider) && (
              <Badge variant="warning" size="sm" className="text-xs">
                Custom Price
              </Badge>
            )}
          </div>

          {/* Spacer to push price to bottom */}
          <div className="flex-1"></div>

          {/* Price Display */}
          <div className="w-full pt-3 border-t mt-auto">
            {getPriceDisplay()}
          </div>

          {/* Admin Info */}
          {isAdmin && (
            <div className="w-full pt-3 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">Status:</span>
                <Switch
                  checked={product.active}
                  onCheckedChange={() => onToggleStatus(product.id, product.active)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-4 sm:p-5 lg:p-6 pt-0 flex gap-2">
        {/* Provider and Staff with ordering privileges Actions */}
        {canOrder && (
          <Button
            className="w-full min-h-[44px] text-sm sm:text-base"
            onClick={() => onAddToCart(product)}
            disabled={!product.active || (product.requires_prescription && !canOrderRx)}
          >
            {product.requires_prescription && !canOrderRx ? (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Add Provider with NPI
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Add to Cart
              </>
            )}
          </Button>
        )}

        {/* Admin Actions */}
        {isAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full min-h-[44px] text-sm sm:text-base">
                <MoreVertical className="h-4 w-4 mr-2" />
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(product)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(product)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardFooter>
    </Card>
  );
});
