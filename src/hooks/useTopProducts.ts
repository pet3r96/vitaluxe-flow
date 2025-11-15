import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TopProduct {
  name: string;
  sales: number;
  revenue: number;
  trend: string;
}

export function useTopProducts() {
  return useQuery({
    queryKey: ["top-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_lines")
        .select(`
          product_id,
          price,
          products (
            name
          )
        `)
        .not("products", "is", null)
        .limit(1000);

      if (error) throw error;

      // Aggregate by product
      const productMap = new Map<string, { name: string; sales: number; revenue: number }>();
      
      data?.forEach((line: any) => {
        const productName = line.products?.name;
        if (!productName) return;
        
        const existing = productMap.get(productName);
        if (existing) {
          existing.sales += 1;
          existing.revenue += line.price || 0;
        } else {
          productMap.set(productName, {
            name: productName,
            sales: 1,
            revenue: line.price || 0,
          });
        }
      });

      // Convert to array and sort by revenue
      const products = Array.from(productMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
        .map((p) => ({
          ...p,
          trend: "+15%", // Can be enhanced with historical comparison
        }));

      return products;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}
