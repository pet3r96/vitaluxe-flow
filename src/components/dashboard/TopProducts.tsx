import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Package } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useTopProducts } from "@/hooks/useTopProducts";
import { Skeleton } from "@/components/ui/skeleton";

export function TopProducts() {
  const { data: topProducts, isLoading } = useTopProducts();
  const maxRevenue = topProducts ? Math.max(...topProducts.map(p => p.revenue)) : 1;
  return (
    <Card variant="modern">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          Top Products
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {topProducts?.map((product, index) => (
            <div key={product.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" size="xs" className="font-mono">#{index + 1}</Badge>
                  <span className="text-sm font-semibold truncate">{product.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="success" size="xs" className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {product.trend}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{product.sales} sales</span>
                <span className="font-semibold text-primary">${product.revenue.toLocaleString()}</span>
              </div>
              <Progress 
                value={(product.revenue / maxRevenue) * 100} 
                className="h-2"
              />
            </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
