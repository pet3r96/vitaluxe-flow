import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subMonths, format } from "date-fns";

interface RevenueDataPoint {
  name: string;
  revenue: number;
}

export function useRevenueData() {
  return useQuery({
    queryKey: ["revenue-chart-data"],
    queryFn: async () => {
      const sevenMonthsAgo = subMonths(new Date(), 6);
      
      const { data, error } = await supabase
        .from("orders")
        .select("created_at, total_amount")
        .gte("created_at", sevenMonthsAgo.toISOString())
        .eq("payment_status", "paid")
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Group by month
      const monthlyRevenue = new Map<string, number>();
      
      data?.forEach((order) => {
        const month = format(new Date(order.created_at), "MMM");
        const current = monthlyRevenue.get(month) || 0;
        monthlyRevenue.set(month, current + (order.total_amount || 0));
      });

      // Convert to array format
      const result: RevenueDataPoint[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const monthKey = format(date, "MMM");
        result.push({
          name: monthKey,
          revenue: monthlyRevenue.get(monthKey) || 0,
        });
      }

      return result;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}
