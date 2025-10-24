import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { OrderDetailsDialog } from "./OrderDetailsDialog";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { logger } from "@/lib/logger";
import { OrderStatusTabs } from "./OrderStatusTabs";
import { OrdersToolbar } from "./OrdersToolbar";
import { OrdersCardView } from "./OrdersCardView";
import { downloadCSV } from "@/lib/csvExport";
import { toast } from "sonner";

export const OrdersDataTable = () => {
  const { effectiveRole, effectiveUserId, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Fetch available order statuses from config
  const { data: orderStatusConfigs } = useQuery({
    queryKey: ["order_status_configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_status_configs")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ["orders", effectiveRole, effectiveUserId, user?.id],
    staleTime: 0, // Always consider stale - realtime handles updates
    refetchInterval: false, // Disable polling - use realtime instead
    refetchOnWindowFocus: true, // Refetch when tab gains focus
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
        
        // Filter out orders with failed payments
        return Array.from(ordersMap.values()).filter(order => order.payment_status !== 'payment_failed');
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

      const { data, error } = await query
        .neq('payment_status', 'payment_failed')
        .order("created_at", { ascending: false });

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
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      order.id.toLowerCase().includes(searchLower) ||
      order.profiles?.name?.toLowerCase().includes(searchLower) ||
      order.order_lines?.some((line: any) =>
        line.patient_name?.toLowerCase().includes(searchLower) ||
        line.products?.name?.toLowerCase().includes(searchLower)
      );
    
    // Filter by ORDER STATUS (not shipping status)
    const matchesStatus =
      statusFilter === "all" ||
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
      on_hold: "bg-yellow-100 text-yellow-800 border border-yellow-300",
      change_requested: "bg-amber-500 text-white",
      mixed: "bg-gradient-to-r from-primary to-secondary text-white",
    };
    return colors[status] || "bg-muted";
  };

  const getStatusLabel = (status: string, count: number) => {
    if (status === "all") {
      return `All Order Statuses (${count})`;
    }
    
    const config = orderStatusConfigs?.find(c => c.status_key === status);
    const label = config?.display_name || status;
    return `${label} (${count})`;
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
      toast.error('Failed to download prescription');
    }
  };

  const handleExport = () => {
    if (!filteredOrders || filteredOrders.length === 0) {
      toast.error('No orders to export');
      return;
    }

    const csvRows = filteredOrders.map(order => {
      const firstLine = order.order_lines?.[0];
      return [
        order.id.slice(0, 8),
        new Date(order.created_at).toLocaleDateString(),
        firstLine?.patient_name || 'N/A',
        order.profiles?.name || 'N/A',
        order.order_lines?.map((l: any) => l.products?.name).join('; ') || 'N/A',
        order.total_amount,
        order.status,
        order.payment_status,
        order.ship_to || 'N/A',
      ];
    });

    const headers = [
      'Order ID',
      'Date',
      'Patient',
      'Doctor/Practice',
      'Products',
      'Total',
      'Status',
      'Payment',
      'Fulfillment',
    ];

    downloadCSV(csvRows, headers, 'orders');
    toast.success(`Exported ${filteredOrders.length} orders`);
  };

  return (
    <div className="space-y-6">
      <OrderStatusTabs
        activeStatus={statusFilter}
        onStatusChange={setStatusFilter}
        orders={orders || []}
        availableStatuses={orderStatusConfigs || []}
      />

      <OrdersToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onExport={handleExport}
        totalOrders={filteredOrders?.length || 0}
      />

      <OrdersCardView
        orders={paginatedOrders || []}
        isLoading={isLoading}
        effectiveRole={effectiveRole}
        onViewDetails={(order) => {
          setSelectedOrder(order);
          setDetailsOpen(true);
        }}
        onDownloadPrescription={handlePrescriptionDownload}
        getStatusColor={getStatusColor}
        getPaymentStatusColor={getPaymentStatusColor}
        getPaymentStatusLabel={getPaymentStatusLabel}
      />

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
