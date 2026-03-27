import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShoppingCart, Plus, Minus } from "lucide-react";
import { ProProduct } from "@/hooks/useProProductsAdmin";

interface ProProductCardProps {
  product: ProProduct;
  onAddToCart: (productId: string, quantity: number) => void;
  isAdding?: boolean;
}

export function ProProductCard({ product, onAddToCart, isAdding }: ProProductCardProps) {
  const [quantity, setQuantity] = useState(1);

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 bg-card">
      <CardContent className="p-5 flex flex-col h-full">
        <div className="flex-1">
          <h3 className="font-semibold text-foreground text-base mb-1">
            {product.name}
          </h3>
          <span className="inline-block text-xs font-medium text-primary/80 bg-primary/10 rounded px-1.5 py-0.5 mb-2">
            Pack of 10
          </span>
          {product.description && product.description !== "Pack of 10" && (
            <p className="text-sm text-muted-foreground mb-3">{product.description}</p>
          )}
        </div>

        <div className="mt-auto space-y-3">
          <p className="text-xl font-bold text-primary">
            ${product.price.toLocaleString()}
          </p>

          <div className="flex items-center gap-2">
            <div className="flex items-center border border-border rounded-md">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="h-8 w-12 text-center border-0 p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setQuantity(quantity + 1)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            <Button
              onClick={() => {
                onAddToCart(product.id, quantity);
                setQuantity(1);
              }}
              disabled={isAdding}
              className="flex-1"
              size="sm"
            >
              <ShoppingCart className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
