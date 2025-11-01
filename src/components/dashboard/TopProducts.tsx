import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Package } from "lucide-react";
import { Progress } from "@/components/ui/progress";

// Sample data - replace with real data from your backend
const topProducts = [
  { name: "Botox 100 Units", sales: 145, revenue: 43500, trend: "+15%" },
  { name: "Juvederm Ultra Plus", sales: 98, revenue: 29400, trend: "+8%" },
  { name: "Restylane Lyft", sales: 87, revenue: 26100, trend: "+12%" },
  { name: "Sculptra Aesthetic", sales: 76, revenue: 22800, trend: "+5%" },
  { name: "Kybella Injection", sales: 62, revenue: 18600, trend: "+3%" },
];

const maxRevenue = Math.max(...topProducts.map(p => p.revenue));

export function TopProducts() {
  return (
    <Card variant="modern">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          Top Products
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {topProducts.map((product, index) => (
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
      </CardContent>
    </Card>
  );
}
