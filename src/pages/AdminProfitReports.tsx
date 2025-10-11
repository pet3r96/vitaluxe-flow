import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const AdminProfitReports = () => {
  // Get profit details with order and product information
  const { data: profitDetails, isLoading } = useQuery({
    queryKey: ["admin-profit-details"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_profits")
        .select(`
          *,
          orders:order_id (
            id,
            created_at,
            status,
            doctor_id,
            profiles:doctor_id (name)
          ),
          order_lines:order_line_id (
            product_id,
            products:product_id (name)
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const totalAdminProfit = profitDetails?.reduce((sum, item) => 
    sum + parseFloat(item.admin_profit?.toString() || '0'), 0
  ) || 0;

  const pendingAdminProfit = profitDetails
    ?.filter(item => ['pending', 'processing'].includes(item.orders?.status || ''))
    .reduce((sum, item) => sum + parseFloat(item.admin_profit?.toString() || '0'), 0) || 0;

  const collectedAdminProfit = profitDetails
    ?.filter(item => ['shipped', 'delivered'].includes(item.orders?.status || ''))
    .reduce((sum, item) => sum + parseFloat(item.admin_profit?.toString() || '0'), 0) || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Profit Reports</h1>
        <p className="text-muted-foreground mt-2">
          Detailed breakdown of platform earnings
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Admin Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalAdminProfit.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">All-time platform earnings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Pending Admin Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">${pendingAdminProfit.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Not yet delivered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Collected Admin Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${collectedAdminProfit.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Delivered orders</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Admin Profit History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Practice</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Admin Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : profitDetails?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No profit data yet
                  </TableCell>
                </TableRow>
              ) : (
                profitDetails?.map((profit: any) => (
                  <TableRow key={profit.id}>
                    <TableCell>
                      {profit.created_at ? format(new Date(profit.created_at), "MMM d, yyyy") : "-"}
                    </TableCell>
                    <TableCell>{profit.orders?.profiles?.name || "-"}</TableCell>
                    <TableCell>{profit.order_lines?.products?.name || "-"}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {profit.order_id?.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        profit.orders?.status === 'shipped' || profit.orders?.status === 'delivered' 
                          ? 'default' 
                          : 'secondary'
                      }>
                        {profit.orders?.status || 'unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${parseFloat(profit.admin_profit?.toString() || '0').toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminProfitReports;
