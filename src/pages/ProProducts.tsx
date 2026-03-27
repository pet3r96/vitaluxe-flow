import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart } from "lucide-react";
import { useActiveProProducts } from "@/hooks/useProProductsAdmin";
import { useProCartCount, useAddToProCart } from "@/hooks/useProCart";
import { ProProductCard } from "@/components/pro-products/ProProductCard";

export default function ProProducts() {
  const { data: products, isLoading } = useActiveProProducts();
  const { data: cartCount = 0 } = useProCartCount();
  const addToCart = useAddToProCart();
  const navigate = useNavigate();

  return (
    <div className="responsive-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pro Products</h1>
          <p className="text-muted-foreground">Pro-use peptides — ships to practice only</p>
        </div>
        <Button variant="outline" className="relative w-fit" onClick={() => navigate("/pro-cart")}>
          <ShoppingCart className="h-5 w-5" />
          {cartCount > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
              {cartCount}
            </Badge>
          )}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
          {products?.map((product) => (
            <ProProductCard
              key={product.id}
              product={product}
              onAddToCart={(id, qty) => addToCart.mutate({ productId: id, quantity: qty })}
              isAdding={addToCart.isPending}
            />
          ))}
          {products?.length === 0 && (
            <p className="col-span-full text-center text-muted-foreground py-12">
              No products available yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
