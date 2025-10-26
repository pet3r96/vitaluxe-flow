import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { DollarSign, Clock, CheckCircle, Tag } from "lucide-react";

const PracticeProfitReports = () => {
  const { effectiveRole, effectiveUserId } = useAuth();

  // Only doctors (practices) can access this report
  if (effectiveRole !== 'doctor') {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Access denied</p>
      </div>
    );
  }

  // Get orders for the practice
  const { data: orders, isLoading } = useQuery({
    queryKey: ["practice-orders", effectiveUserId],
    staleTime: 60000, // 1 minute
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          created_at,
          status,
          total_amount,
          payment_status,
          discount_code,
          discount_percentage,
          discount_amount,
          subtotal_before_discount,
          order_lines (
            id,
            product_id,
            quantity,
            price,
            products:product_id (name)
          )
        `)
        .eq("doctor_id", effectiveUserId)
        .neq("payment_status", "payment_failed")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveUserId,
  });

  // Calculate summary metrics
  const totalSpent = orders
    ?.filter(order => order.status !== 'cancelled')
    .reduce((sum, order) => sum + parseFloat(order.total_amount?.toString() || '0'), 0) || 0;
  
  const pendingAmount = orders
    ?.filter(order => ['pending', 'processing'].includes(order.status || ''))
    .reduce((sum, order) => sum + parseFloat(order.total_amount?.toString() || '0'), 0) || 0;
  
  const completedAmount = orders
    ?.filter(order => ['shipped', 'delivered'].includes(order.status || ''))
    .reduce((sum, order) => sum + parseFloat(order.total_amount?.toString() || '0'), 0) || 0;

  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    hasNextPage,
    hasPrevPage
  } = usePagination({
    totalItems: orders?.length || 0,
    itemsPerPage: 25
  });

  const paginatedOrders = orders?.slice(startIndex, endIndex);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'delivered': return 'default';
      case 'shipped': return 'secondary';
      case 'processing': return 'outline';
      case 'pending': return 'outline';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">Practice Reports</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          View your order history and spending summary
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              ${totalSpent.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">All-time order total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              ${pendingAmount.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">In processing or pending</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Orders</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              ${completedAmount.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Shipped or delivered</p>
          </CardContent>
        </Card>
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Order History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Loading orders...
                  </TableCell>
                </TableRow>
              ) : !paginatedOrders || paginatedOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No orders found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedOrders.map((order: any) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      {order.created_at ? format(new Date(order.created_at), "MMM d, yyyy") : "-"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {order.id.substring(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {order.order_lines?.slice(0, 2).map((line: any, idx: number) => (
                          <span key={idx} className="text-sm">
                            {line.products?.name || 'Unknown'} (x{line.quantity})
                          </span>
                        ))}
                        {order.order_lines?.length > 2 && (
                          <span className="text-xs text-muted-foreground">
                            +{order.order_lines.length - 2} more
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {order.discount_code ? (
                        <div className="flex flex-col gap-1">
                          <Badge variant="secondary" className="text-xs w-fit">
                            {order.discount_code}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {order.discount_percentage}% off
                          </span>
                          {order.discount_amount && (
                            <span className="text-xs text-green-600">
                              -${parseFloat(order.discount_amount?.toString() || '0').toFixed(2)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(order.status)}>
                        {order.status || 'unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${parseFloat(order.total_amount?.toString() || '0').toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {orders && orders.length > 0 && (
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          totalItems={orders.length}
          startIndex={startIndex}
          endIndex={Math.min(endIndex, orders.length)}
        />
      )}
    </div>
  );
};

export default PracticeProfitReports;
