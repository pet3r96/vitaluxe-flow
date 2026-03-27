import { useProOrders } from "@/hooks/useProOrders";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export default function ProOrders() {
  const { data: orders = [], isLoading } = useProOrders();

  return (
    <div className="responsive-page">
      <h1 className="text-2xl font-bold text-foreground">Pro Orders</h1>
      <p className="text-muted-foreground mb-6">Professional product order history</p>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : orders.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No orders yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Contact</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell>{format(new Date(order.created_at), "MMM d, yyyy")}</TableCell>
                <TableCell>
                  {(order.line_items as any[]).length} item(s)
                </TableCell>
                <TableCell className="font-semibold">
                  ${order.total.toLocaleString()}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {order.contact_name}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
