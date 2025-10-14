import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, ShoppingCart, Percent, Users } from "lucide-react";
import { format } from "date-fns";

interface DiscountCodeStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  discountCode?: any;
}

export const DiscountCodeStatsDialog = ({
  open,
  onOpenChange,
  discountCode,
}: DiscountCodeStatsDialogProps) => {
  const { data: stats } = useQuery({
    queryKey: ["discount-code-stats", discountCode?.code],
    queryFn: async () => {
      if (!discountCode?.code) return null;

      const { data, error } = await supabase.rpc("get_discount_code_stats", {
        p_code: discountCode.code,
      });

      if (error) throw error;
      return data?.[0] || { total_uses: 0, unique_users: 0, total_discount_amount: 0, total_orders: 0 };
    },
    enabled: !!discountCode?.code && open,
  });

  const { data: recentOrders } = useQuery({
    queryKey: ["discount-code-recent-orders", discountCode?.code],
    queryFn: async () => {
      if (!discountCode?.code) return [];

      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          created_at,
          total_amount,
          discount_amount,
          discount_percentage,
          status,
          profiles:doctor_id (
            name,
            email
          )
        `)
        .eq("discount_code", discountCode.code)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    enabled: !!discountCode?.code && open,
  });

  if (!discountCode) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Statistics for {discountCode.code}
          </DialogTitle>
          <DialogDescription>
            Usage statistics and revenue impact for this discount code
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Uses</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.total_uses || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {discountCode.max_uses
                    ? `of ${discountCode.max_uses} maximum`
                    : "Unlimited uses"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  Unique Customers
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(stats as any)?.unique_users || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Different customers who used this code
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Discount</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${parseFloat(String(stats?.total_discount_amount || "0")).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total amount discounted
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Discount Rate</CardTitle>
                <Percent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {discountCode.discount_percentage}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Applied to all orders
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Orders */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Practice</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Discount</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentOrders && recentOrders.length > 0 ? (
                      recentOrders.map((order: any) => (
                        <TableRow key={order.id}>
                          <TableCell>
                            {format(new Date(order.created_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{order.profiles?.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {order.profiles?.email}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                order.status === "completed"
                                  ? "default"
                                  : order.status === "cancelled"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-green-600 font-medium">
                            -${parseFloat(String(order.discount_amount || "0")).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ${parseFloat(String(order.total_amount || "0")).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No orders yet using this discount code
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
