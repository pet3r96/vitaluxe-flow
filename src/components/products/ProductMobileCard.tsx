import { Eye, Edit, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { formatCurrency } from "@/lib/formatters";
import { memo } from "react";

interface ProductMobileCardProps {
  product: any;
  isAdmin: boolean;
  isProvider: boolean;
  isRep: boolean;
  onView: (product: any) => void;
  onEdit: (product: any) => void;
  onAddToCart: (product: any) => void;
  onDelete: (product: any) => void;
  onToggleStatus: (productId: string, currentStatus: boolean) => void;
}

export const ProductMobileCard = memo(({
  product,
  isAdmin,
  isProvider,
  isRep,
  onView,
  onEdit,
  onAddToCart,
  onDelete,
  onToggleStatus
}: ProductMobileCardProps) => {
  const pharmacyCount = product.product_pharmacies?.length || 0;
  const activePharmacies = product.product_pharmacies?.filter((pp: any) => pp.pharmacy?.active).length || 0;

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-card hover:bg-accent/5 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{product.name}</div>
          <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {product.description || "No description"}
          </div>
        </div>
        <Badge variant={product.active ? "default" : "secondary"} className="shrink-0">
          {product.active ? "Active" : "Inactive"}
        </Badge>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Price:</span>
          <span className="font-semibold">{formatCurrency(product.price)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">Pharmacies:</span>
          <span>{activePharmacies} / {pharmacyCount}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">Category:</span>
          <span className="capitalize">{product.category || "N/A"}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">Type:</span>
          <span className="capitalize">{product.type || "N/A"}</span>
        </div>

        {product.requires_prescription && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Prescription:</span>
            <Badge variant="outline" className="text-xs">Required</Badge>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2 border-t flex-wrap">
        {isAdmin && (
          <>
            <Button variant="outline" size="sm" onClick={() => onView(product)} className="flex-1 min-w-[80px]">
              <Eye className="h-3.5 w-3.5 mr-1" />
              View
            </Button>
            <Button variant="outline" size="sm" onClick={() => onEdit(product)} className="flex-1 min-w-[80px]">
              <Edit className="h-3.5 w-3.5 mr-1" />
              Edit
            </Button>
            <div className="flex items-center gap-2 ml-auto">
              <Switch
                checked={product.active}
                onCheckedChange={() => onToggleStatus(product.id, product.active)}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(product)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {(isProvider || isRep) && (
          <>
            <Button variant="outline" size="sm" onClick={() => onView(product)} className="flex-1">
              <Eye className="h-3.5 w-3.5 mr-1" />
              Details
            </Button>
            {product.active && (
              <Button size="sm" onClick={() => onAddToCart(product)} className="flex-1">
                <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                Add to Cart
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
});

ProductMobileCard.displayName = "ProductMobileCard";
