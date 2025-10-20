import { useState, useEffect } from "react";
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
import { Search, Eye, Download } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrderDetailsDialog } from "./OrderDetailsDialog";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { ReceiptDownloadButton } from "./ReceiptDownloadButton";
import { logger } from "@/lib/logger";

export const OrdersDataTable = () => {
  const { effectiveRole, effectiveUserId, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ["orders", effectiveRole, effectiveUserId, user?.id],
    staleTime: 0,
    queryFn: async () => {
      logger.info('OrdersDataTable query', logger.sanitize({ 
        effectiveRole, 
        effectiveUserId,
        authUid: user?.id 
      }));

      // Special handling for pharmacy users - fetch from order_lines
      if (effectiveRole === "pharmacy") {
        const { data: pharmacyData } = await supabase
          .from("pharmacies")
          .select("id")
          .eq("user_id", effectiveUserId)
          .maybeSingle();
        
        if (!pharmacyData) {
          return []; // Pharmacy not found
        }

        const { data: orderLinesData, error: orderLinesError } = await supabase
          .from("order_lines")
          .select(`
            id,
            order_id,
            product_id,
            provider_id,
            patient_id,
            quantity,
            price,
            status,
            tracking_number,
            assigned_pharmacy_id,
            created_at,
            updated_at,
            shipping_speed,
            shipping_carrier,
            shipping_cost,
            destination_state,
            order_notes,
            processing_at,
            shipped_at,
            delivered_at,
            price_before_discount,
            discount_amount,
            discount_percentage,
            refills_allowed,
            refills_total,
            refills_remaining,
            original_order_line_id,
            is_refill,
            refill_number,
            prescription_method,
            patient_name,
            patient_email,
            patient_phone,
            patient_address,
            prescription_url,
            custom_dosage,
            custom_sig,
            products(name, product_types(name)),
            pharmacies:assigned_pharmacy_id(name),
            providers!order_lines_provider_id_fkey(
              id,
              practice_id
            ),
            patients(allergies),
            orders!inner(
              *,
              profiles:doctor_id(name)
            )
          `)
          .eq("assigned_pharmacy_id", pharmacyData.id)
          .order("created_at", { ascending: false });

        if (orderLinesError) {
          logger.error('Pharmacy order lines query error', orderLinesError);
          throw orderLinesError;
        }

        // Transform data to match expected format - group order_lines by order
        const ordersMap = new Map();
        (orderLinesData as any)?.forEach((line: any) => {
          const orderId = line.orders.id;
          if (!ordersMap.has(orderId)) {
            ordersMap.set(orderId, {
              ...line.orders,
              order_lines: []
            });
          }
          // Remove the nested orders object from the line before adding to array
          const { orders: _, ...lineWithoutOrders } = line;
          ordersMap.get(orderId).order_lines.push(lineWithoutOrders);
        });
        
        return Array.from(ordersMap.values());
      }

      let query = supabase
        .from("orders")
        .select(`
          *,
          order_lines(*,
            products(name, product_types(name)),
            pharmacies:assigned_pharmacy_id(name),
            providers!order_lines_provider_id_fkey(
              id,
              practice_id
            ),
            patients(allergies)
          ),
          profiles:doctor_id(name)
        `);

      // For doctor role, explicitly filter by doctor_id (defense in depth with RLS)
      if (effectiveRole === "doctor") {
        query = query.eq("doctor_id", effectiveUserId);
      }

      // Filter by provider if role is provider
      if (effectiveRole === "provider") {
        // Get provider id first
        const { data: providerData } = await supabase
          .from("providers")
          .select("id")
          .eq("user_id", effectiveUserId)
          .maybeSingle();
        
        if (providerData) {
          // Get all order IDs that have at least one line by this provider
          const { data: providerOrderLines } = await supabase
            .from("order_lines")
            .select("order_id")
            .eq("provider_id", providerData.id);
          
          const orderIds = providerOrderLines?.map(ol => ol.order_id) || [];
          
          if (orderIds.length === 0) {
            return []; // No orders for this provider
          }
          
          query = query.in("id", orderIds);
        } else {
          return []; // Provider not found
        }
      }

      // Filter by downline rep if role is downline
      if (effectiveRole === "downline") {
        // Downlines see orders from practices linked to them
        const { data: practices } = await supabase
          .from("profiles")
          .select("id")
          .eq("linked_topline_id", effectiveUserId)  // practices linked to THIS downline
          .eq("active", true);
        
        const practiceIds = practices?.map(p => p.id) || [];
        
        if (practiceIds.length === 0) {
          return []; // No practices assigned, no orders
        }
        
        query = query.in("doctor_id", practiceIds);
      }

      // Filter by topline rep if role is topline
      if (effectiveRole === "topline") {
        // First get the topline's rep ID
        const { data: toplineRep } = await supabase
          .from("reps")
          .select("id")
          .eq("user_id", effectiveUserId)
          .eq("role", "topline")
          .maybeSingle();
        
        if (!toplineRep) {
          return []; // No rep record found
        }
        
        // Get all downlines assigned to this topline
        const { data: downlines } = await supabase
          .from("reps")
          .select("user_id")
          .eq("role", "downline")
          .eq("assigned_topline_id", toplineRep.id);
        
        const downlineUserIds = downlines?.map(d => d.user_id) || [];
        
        // Add the topline's own user_id to also catch practices linked directly
        const allUserIds = [effectiveUserId, ...downlineUserIds];
        
        // Get practices linked to any of these users
        const { data: practices } = await supabase
          .from("profiles")
          .select("id")
          .in("linked_topline_id", allUserIds)
          .eq("active", true);
        
        const practiceIds = practices?.map(p => p.id) || [];
        
        if (practiceIds.length === 0) {
          return []; // No practices assigned, no orders
        }
        
        query = query.in("doctor_id", practiceIds);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Set up real-time subscription for order updates
  useEffect(() => {
    // Don't set up subscription if no effective user
    if (!effectiveUserId) return;
    
    const channel = supabase
      .channel('order-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: effectiveRole === 'doctor' ? `doctor_id=eq.${effectiveUserId}` : undefined
        },
        () => {
          logger.info('Order update detected, refetching');
          refetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_lines'
        },
        () => {
          logger.info('Order line update detected, refetching');
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [effectiveUserId, effectiveRole, refetch]);

  const filteredOrders = orders?.filter((order) => {
    const matchesSearch =
      order.profiles?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.order_lines?.some((line: any) =>
        line.patient_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    
    const shippingStatuses = order.order_lines?.map((line: any) => line.status) || [];
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "denied" && shippingStatuses.includes("denied")) ||
      order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    hasNextPage,
    hasPrevPage
  } = usePagination({
    totalItems: filteredOrders?.length || 0,
    itemsPerPage: 25
  });

  const paginatedOrders = filteredOrders?.slice(startIndex, endIndex);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-muted text-muted-foreground",
      filled: "bg-primary text-primary-foreground",
      processing: "bg-primary text-primary-foreground",
      shipped: "bg-secondary text-secondary-foreground",
      delivered: "bg-accent text-accent-foreground",
      completed: "bg-accent text-accent-foreground",
      denied: "bg-destructive text-destructive-foreground",
      canceled: "bg-destructive text-destructive-foreground",
      cancelled: "bg-destructive text-destructive-foreground",
      change_requested: "bg-amber-500 text-white",
      mixed: "bg-gradient-to-r from-primary to-secondary text-white",
    };
    return colors[status] || "bg-muted";
  };

  const getStatusLabel = (status: string, count: number) => {
    const labels: Record<string, string> = {
      all: "All Statuses",
      pending: "Pending",
      processing: "Processing",
      shipped: "Shipped",
      denied: "Denied",
      delivered: "Delivered",
      cancelled: "Cancelled",
    };
    return `${labels[status] || status} (${count})`;
  };

  const getPaymentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      paid: "bg-green-500 text-white",
      payment_failed: "bg-destructive text-destructive-foreground",
      pending: "bg-muted text-muted-foreground",
      refunded: "bg-purple-500 text-white",
      partially_refunded: "bg-amber-500 text-white",
    };
    return colors[status] || "bg-muted";
  };

  const getPaymentStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      paid: "Approved",
      payment_failed: "Declined",
      pending: "Pending",
      refunded: "Refunded",
      partially_refunded: "Partial Refund",
    };
    return labels[status] || status;
  };

  const handlePrescriptionDownload = async (prescriptionUrl: string, productName: string) => {
    try {
      const response = await fetch(prescriptionUrl);
      if (!response.ok) {
        throw new Error('Failed to download prescription');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const urlParts = prescriptionUrl.split('/');
      const filename = urlParts[urlParts.length - 1].split('?')[0];
      const extension = filename.includes('.') ? filename.split('.').pop() : 'pdf';
      link.download = `prescription_${productName.replace(/\s+/g, '_')}.${extension}`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Prescription download error', error);
    }
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
            <SelectValue>
              {getStatusLabel(statusFilter, filteredOrders?.length || 0)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="denied">Denied</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border border-border bg-card overflow-x-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="min-w-[2000px]">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead>Patient Name</TableHead>
              <TableHead>Fulfillment Type</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Prescription</TableHead>
              <TableHead>Shipping</TableHead>
              <TableHead>Shipping Status</TableHead>
              <TableHead>Carrier</TableHead>
              {effectiveRole !== "pharmacy" && <TableHead>Total Amount</TableHead>}
              <TableHead>Status</TableHead>
              <TableHead>Payment Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={effectiveRole === "pharmacy" ? 13 : 14} className="text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredOrders?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={effectiveRole === "pharmacy" ? 13 : 14} className="text-center text-muted-foreground">
                  No orders found
                </TableCell>
              </TableRow>
            ) : (
              paginatedOrders?.map((order) => {
                const firstOrderLine = order.order_lines?.[0];
                const patientId = firstOrderLine?.patient_id;
                const patientName = firstOrderLine?.patient_name || "N/A";
                
                // Aggregate shipping status from order lines
                const shippingStatuses = order.order_lines?.map((line: any) => line.status) || [];
                const uniqueStatuses = [...new Set(shippingStatuses)];
                const shippingStatus: string = uniqueStatuses.length === 1 
                  ? (uniqueStatuses[0] as string)
                  : uniqueStatuses.length > 1 
                    ? "mixed" 
                    : "pending";
                
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
                      <div className="space-y-1">
                        {order.order_lines?.map((line: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {line.products?.product_types?.name || "Unknown"}
                            </Badge>
                            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                              {line.products?.name || "N/A"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {effectiveRole === "pharmacy" ? (
                        // For pharmacies, show Yes/No badge (no download)
                        <div className="space-y-1">
                          {order.order_lines?.map((line: any, idx: number) => (
                            <Badge 
                              key={idx} 
                              variant={line.prescription_url ? "default" : "outline"} 
                              className="text-xs"
                            >
                              {line.prescription_url ? 'Yes' : 'No'}
                            </Badge>
                          ))}
                        </div>
                      ) : order.order_lines?.some((line: any) => line.prescription_url) ? (
                        // For non-pharmacy roles, show download button
                        <div className="space-y-1">
                          {order.order_lines?.map((line: any, idx: number) => 
                            line.prescription_url ? (
                              <Button
                                key={idx}
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  handlePrescriptionDownload(
                                    line.prescription_url,
                                    line.products?.name || 'prescription'
                                  );
                                }}
                                className="h-7 px-2 text-xs"
                              >
                                <Download className="h-3 w-3 mr-1" />
                                Rx
                              </Button>
                            ) : null
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {order.order_lines?.[0]?.shipping_speed === '2day' ? '2-Day' : 
                         order.order_lines?.[0]?.shipping_speed === 'overnight' ? 'Overnight' : 
                         'Ground'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(shippingStatus)}>
                        {shippingStatus === "mixed" ? "Mixed Status" : shippingStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">
                      {order.order_lines?.[0]?.shipping_carrier || "-"}
                    </TableCell>
                    {effectiveRole !== "pharmacy" && <TableCell>${order.total_amount}</TableCell>}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(order.status)}>
                          {order.status}
                        </Badge>
                        {order.status_manual_override && (
                          <Badge variant="outline" className="text-xs">
                            Manual
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPaymentStatusColor(order.payment_status)}>
                        {getPaymentStatusLabel(order.payment_status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(order.created_at).toLocaleDateString()}
                    </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <ReceiptDownloadButton
                        orderId={order.id}
                        orderDate={order.created_at}
                        practiceName={order.profiles?.name || "Practice"}
                      />
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
                    </div>
                  </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      {filteredOrders && filteredOrders.length > 0 && (
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          totalItems={filteredOrders.length}
          startIndex={startIndex}
          endIndex={Math.min(endIndex, filteredOrders.length)}
        />
      )}

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
