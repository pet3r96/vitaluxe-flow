import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill, PackageCheck, ShoppingCart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export const OrderStatistics = () => {
  const { effectiveRole, effectiveUserId, effectivePracticeId } = useAuth();

  // Only show order statistics for admin and reps (not pharmacy)
  if (!["admin", "topline", "downline"].includes(effectiveRole)) {  // ✅ Remove pharmacy
    return null;
  }

  const { data: stats, isLoading } = useQuery({
    queryKey: ["order-statistics", effectiveRole, effectiveUserId, effectivePracticeId],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select(`
          id,
          payment_status,
          status,
          order_lines (
            id,
            products (
              requires_prescription
            )
          )
        `)
        .eq("payment_status", "paid")
        .not("status", "in", '("cancelled","denied")');

      // Apply role-based filtering
      if (effectiveRole === "doctor") {
        query = query.eq("doctor_id", effectiveUserId);
      } else if (effectiveRole === "pharmacy") {
        // Get order IDs for this pharmacy
        const { data: orderLines } = await supabase
          .from("order_lines")
          .select("order_id")
          .eq("assigned_pharmacy_id", effectivePracticeId || effectiveUserId);
        
        const orderIds = orderLines?.map((ol) => ol.order_id) || [];
        if (orderIds.length === 0) {
          return { nonRxOrders: 0, rxOrders: 0, totalOrders: 0 };
        }
        query = query.in("id", orderIds);
      } else if (effectiveRole === "topline" || effectiveRole === "downline") {
        // Get practices linked to this rep
        const { data: practices } = await supabase
          .from("profiles")
          .select("id")
          .eq("linked_topline_id", effectiveUserId);

        if (practices && practices.length > 0) {
          const practiceIds = practices.map((p) => p.id);
          query = query.in("practice_id", practiceIds);
        } else {
          // No practices, return empty result
          return { nonRxOrders: 0, rxOrders: 0, totalOrders: 0 };
        }
      }

      const { data: orders, error } = await query;

      if (error) throw error;

      // Count orders by prescription requirement
      let nonRxOrders = 0;
      let rxOrders = 0;

      orders?.forEach((order) => {
        const hasRxProduct = order.order_lines?.some(
          (line: any) => line.products?.requires_prescription === true
        );
        const hasNonRxProduct = order.order_lines?.some(
          (line: any) => line.products?.requires_prescription === false
        );

        // Classify order based on product types
        if (hasRxProduct && !hasNonRxProduct) {
          rxOrders++;
        } else if (!hasRxProduct && hasNonRxProduct) {
          nonRxOrders++;
        } else if (hasRxProduct && hasNonRxProduct) {
          // Mixed order - count as both
          rxOrders++;
          nonRxOrders++;
        }
      });

      return {
        nonRxOrders,
        rxOrders,
        totalOrders: orders?.length || 0,
      };
    },
    enabled: !!effectiveUserId,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-4 w-4 bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted rounded mb-1" />
              <div className="h-3 w-20 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Non-RX Orders</CardTitle>
          <PackageCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.nonRxOrders || 0}</div>
          <p className="text-xs text-muted-foreground">
            Orders without prescription
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">RX Orders</CardTitle>
          <Pill className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.rxOrders || 0}</div>
          <p className="text-xs text-muted-foreground">
            Orders requiring prescription
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.totalOrders || 0}</div>
          <p className="text-xs text-muted-foreground">
            All paid orders
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
