import { memo } from "react";
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
  onEdit,
  onDelete,
  onAddToCart,
  onToggleStatus,
}: ProductCardProps) => {
  const getPriceDisplay = () => {
    if (isAdmin) {
      return (
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Base :</span>
            <span className="font-semibold">${product.base_price}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Topline :</span>
            <span>${product.topline_price || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Downline :</span>
            <span>${product.downline_price || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Practice :</span>
            <span>${product.retail_price || "-"}</span>
          </div>
        </div>
      );
    }

    if (isToplineRep) {
      return (
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Your Price:</span>
            <span className="font-bold text-primary text-lg">${product.topline_price || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Practice Price:</span>
            <span>${product.retail_price || "-"}</span>
          </div>
        </div>
      );
    }

    if (isDownlineRep) {
      return (
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Your Price:</span>
            <span className="font-bold text-primary text-lg">${product.downline_price || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Practice Price:</span>
            <span>${product.retail_price || "-"}</span>
          </div>
        </div>
      );
    }

    if (isProvider) {
      return (
        <div className="text-center">
          <div className="text-3xl font-bold text-primary">
            ${product.retail_price || product.base_price}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <Card className="group hover:shadow-lg transition-shadow duration-200 flex flex-col h-full">
      <CardContent className="p-4 flex-1">
        {/* Product Image */}
        <div className="aspect-square mb-4 rounded-lg overflow-hidden bg-muted">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              No image
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className={`space-y-2 flex flex-col items-start ${isAdmin ? 'h-[320px]' : 'h-[240px]'}`}>
          <h3 className="font-semibold text-lg line-clamp-3">{product.name}</h3>
          {product.dosage && (
            <p className="text-sm text-muted-foreground line-clamp-2">{product.dosage}</p>
          )}

          {/* Badges */}
          <div className="flex flex-wrap gap-2 min-h-[28px] justify-start">
            {product.requires_prescription && (
              <Badge variant="default" className="text-xs">Rx Required</Badge>
            )}
            {product.product_type && (
              <Badge variant="default" className="text-xs">{product.product_type}</Badge>
            )}
            <Badge variant={product.active ? "secondary" : "outline"} className="text-xs">
              {product.active ? "Active" : "Inactive"}
            </Badge>
          </div>

          {/* Spacer to push price to bottom */}
          <div className="flex-1"></div>

          {/* Price Display */}
          <div className="pt-2 border-t mt-auto">
            {getPriceDisplay()}
          </div>

          {/* Admin Info */}
          {isAdmin && (
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status:</span>
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

      <CardFooter className="p-4 pt-0 flex gap-2">
        {/* Provider Actions */}
        {isProvider && (
          <Button
            className="w-full"
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
              <Button variant="outline" className="w-full">
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
