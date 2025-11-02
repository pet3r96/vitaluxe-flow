import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ShoppingCart, Edit, Trash2, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProductCardProps {
  product: any;
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
  const { effectiveUserId, effectiveRole } = useAuth();

  // Helper to format prices consistently
  const formatPrice = (value: any) => {
    if (value == null) return '-';
    return Number(value).toFixed(2);
  };

  // Fetch effective price for current user with immediate refresh
  const { data: effectivePrice } = useQuery({
    queryKey: ['effective-price', product.id, effectiveUserId, effectiveRole],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'get_effective_product_price',
        { 
          p_product_id: product.id,
          p_user_id: effectiveUserId 
        }
      );
      if (error) {
        import('@/lib/logger').then(({ logger }) => {
          logger.error('Error fetching effective price', error);
        });
        return null;
      }
      return data?.[0];
    },
    enabled: !!effectiveUserId && (isToplineRep || isDownlineRep || isProvider),
    staleTime: 30000, // 30 seconds - pricing updates occasionally
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });

  const getPriceDisplay = () => {
    if (isAdmin) {
      return (
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground pr-2">Base:</span>
            <span className="font-semibold">${product.base_price}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground pr-2">Topline:</span>
            <span>
              {product.requires_prescription ? "$-" : `$${product.topline_price || "-"}`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground pr-2">Downline:</span>
            <span>
              {product.requires_prescription ? "$-" : `$${product.downline_price || "-"}`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground pr-2">Practice:</span>
            <span>${product.retail_price || "-"}</span>
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
      return (
        <div className="text-center">
          <div className="text-3xl font-bold text-primary">
            ${formatPrice(effectivePrice?.effective_retail_price ?? product.retail_price ?? product.base_price)}
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
        <div className="aspect-[4/3] mb-3 sm:mb-4 rounded-lg overflow-hidden bg-gradient-to-br from-muted to-muted/50">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
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
            {product.dosage && (
              <p className="text-sm text-muted-foreground line-clamp-1">{product.dosage}</p>
            )}
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2 w-full">
            {product.requires_prescription && (
              <Badge variant="info" size="sm" className="bg-blue-500/15 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border-blue-500/30 text-xs">
                Rx Required
              </Badge>
            )}
            {product.product_type && (
              <Badge variant="secondary" size="sm" className="text-xs">{product.product_type}</Badge>
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
            disabled={!product.active}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Add to Cart
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
