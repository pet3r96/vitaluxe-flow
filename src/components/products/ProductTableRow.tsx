import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Eye, Edit, ShoppingCart, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { memo } from "react";

interface ProductTableRowProps {
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

export const ProductTableRow = memo(({
  product,
  isAdmin,
  isProvider,
  isRep,
  onView,
  onEdit,
  onAddToCart,
  onDelete,
  onToggleStatus
}: ProductTableRowProps) => {
  const pharmacyCount = product.product_pharmacies?.length || 0;
  const activePharmacies = product.product_pharmacies?.filter((pp: any) => pp.pharmacy?.active).length || 0;

  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell className="font-medium">{product.name}</TableCell>
      <TableCell className="max-w-xs truncate">{product.description || "—"}</TableCell>
      <TableCell className="text-right font-semibold">{formatCurrency(product.price)}</TableCell>
      <TableCell className="text-center">
        {activePharmacies} / {pharmacyCount}
      </TableCell>
      <TableCell>
        <Badge variant={product.active ? "default" : "secondary"}>
          {product.active ? "Active" : "Inactive"}
        </Badge>
      </TableCell>
      <TableCell className="capitalize">{product.category || "—"}</TableCell>
      <TableCell className="capitalize">{product.type || "—"}</TableCell>
      <TableCell className="capitalize">{product.dosage_form || "—"}</TableCell>
      <TableCell className="text-center">
        {product.requires_prescription ? (
          <Badge variant="outline" className="text-xs">Yes</Badge>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          {isAdmin && (
            <>
              <Button variant="ghost" size="sm" onClick={() => onView(product)}>
                <Eye className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onEdit(product)}>
                <Edit className="h-4 w-4" />
              </Button>
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
            </>
          )}
          
          {(isProvider || isRep) && (
            <>
              <Button variant="ghost" size="sm" onClick={() => onView(product)}>
                <Eye className="h-4 w-4" />
              </Button>
              {product.active && (
                <Button size="sm" onClick={() => onAddToCart(product)}>
                  <ShoppingCart className="h-4 w-4 mr-1" />
                  Add
                </Button>
              )}
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
});

ProductTableRow.displayName = "ProductTableRow";
