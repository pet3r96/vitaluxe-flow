import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Eye } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrderDetailsDialog } from "./OrderDetailsDialog";

export const OrdersDataTable = () => {
  const { effectiveRole } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          order_lines(*,
            products(name),
            pharmacies:assigned_pharmacy_id(name)
          ),
          profiles:doctor_id(name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const filteredOrders = orders?.filter((order) => {
    const matchesSearch =
      order.profiles?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.order_lines?.some((line: any) =>
        line.patient_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-muted text-muted-foreground",
      processing: "bg-primary text-primary-foreground",
      shipped: "bg-secondary text-secondary-foreground",
      delivered: "bg-accent text-accent-foreground",
      canceled: "bg-destructive text-destructive-foreground",
      cancelled: "bg-destructive text-destructive-foreground",
    };
    return colors[status] || "bg-muted";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead>Patient Name</TableHead>
              <TableHead>Fulfillment Type</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Carrier</TableHead>
              <TableHead>Total Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredOrders?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground">
                  No orders found
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders?.map((order) => {
                const firstOrderLine = order.order_lines?.[0];
                const patientId = firstOrderLine?.patient_id;
                const patientName = firstOrderLine?.patient_name || "N/A";
                
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      #{order.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>{order.profiles?.name || "N/A"}</TableCell>
                    <TableCell>
                      {order.ship_to === 'practice' || !patientId ? (
                        <span className="text-muted-foreground">{patientName}</span>
                      ) : (
                        <Button
                          variant="link"
                          className="h-auto p-0 text-primary font-normal"
                          onClick={() => window.location.href = `/patients?patient=${patientId}`}
                        >
                          {patientName}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={order.ship_to === 'practice' ? 'secondary' : 'outline'}>
                        {order.ship_to === 'practice' ? '🏢 Practice' : '👤 Patient'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {order.order_lines?.length || 0} item(s)
                    </TableCell>
                    <TableCell className="capitalize">
                      {order.order_lines?.[0]?.shipping_carrier || "-"}
                    </TableCell>
                    <TableCell>${order.total_amount}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(order.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedOrder(order);
                          setDetailsOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {selectedOrder && (
        <OrderDetailsDialog
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          order={selectedOrder}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
};
