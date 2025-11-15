import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
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
import { Search, Eye, Download, AlertTriangle } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { OrderQueryMetadata } from "@/types/domain/orders";

export const OrdersDataTable = () => {
  const { effectiveRole, effectiveUserId, effectivePracticeId, user, session } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [queryMetadata, setQueryMetadata] = useState<OrderQueryMetadata>({
    hasRepRecord: true,
    practiceCount: 0,
    practiceNames: [],
    isEmpty: false,
    emptyReason: null
  });

  // Fetch current user's rep ID for commission calculations
  const { data: currentRepId } = useQuery({
    queryKey: ["current-rep-id", effectiveUserId, effectiveRole],
    queryFn: async () => {
      if (effectiveRole !== "topline" && effectiveRole !== "downline") return null;
      
      const { data } = await supabase
        .from("reps")
        .select("id")
        .eq("user_id", effectiveUserId)
        .eq("role", effectiveRole)
        .maybeSingle();
      
      return data?.id || null;
    },
    enabled: effectiveRole === "topline" || effectiveRole === "downline",
  });

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

  const { data: orders, isLoading, refetch, error } = useRealtimeQuery(
    ["orders", effectiveRole, effectiveUserId, user?.id],
    async () => {
      const queryStart = Date.now();
      console.time('OrdersQuery');
      console.log('[OrdersDataTable] Query starting for role:', effectiveRole);
      
      try {
        logger.info('OrdersDataTable query START', logger.sanitize({ 
          effectiveRole, 
          effectiveUserId,
          authUid: user?.id 
        }));

      // For pharmacy users - fetch order_lines assigned to them
      if (effectiveRole === "pharmacy") {
        const { data: pharmacyData } = await supabase
          .from("pharmacies")
          .select("id")
          .eq("user_id", effectiveUserId)
          .maybeSingle();
        
        if (!pharmacyData) {
          return []; // Pharmacy not found
        }

        // Add time filter - last 90 days
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        
        // Fetch order lines - order by created_at on the order_lines table itself
        const { data: orderLinesData, error: orderLinesError } = await supabase
          .from("order_lines")
          .select(`
            id,
            order_id,
            status,
            tracking_number,
            created_at,
            patient_name,
            patient_id,
            shipping_speed,
            products(name, product_types(name)),
            orders!inner(
              id,
              created_at,
              payment_status,
              ship_to,
              status,
              status_manual_override,
              profiles:doctor_id(name, company)
            )
          `)
          .eq("assigned_pharmacy_id", pharmacyData.id)
          .neq("orders.payment_status", "payment_failed")
          .order("created_at", { ascending: false })
          .limit(50); // OPTIMIZED: Reduced from 200 to 50 for better performance

        if (orderLinesError) {
          logger.error('Pharmacy order lines query error', orderLinesError);
          throw orderLinesError;
        }

        // Transform data - group order_lines by order
        const ordersMap = new Map();
        (orderLinesData as any)?.forEach((line: any) => {
          const orderId = line.orders.id;
          if (!ordersMap.has(orderId)) {
            ordersMap.set(orderId, {
              ...line.orders,
              order_lines: []
            });
          }
          const { orders: _, ...lineWithoutOrders } = line;
          ordersMap.get(orderId).order_lines.push(lineWithoutOrders);
        });
        
        const queryDuration = Date.now() - queryStart;
        logger.info('Pharmacy order lines query COMPLETE', { 
          duration: queryDuration,
          lineCount: orderLinesData?.length || 0,
          orderCount: ordersMap.size
        });
        
        // Sort orders by created_at descending
        return Array.from(ordersMap.values()).sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }

      // USE EDGE FUNCTION FOR SIMPLE ROLES (admin, practice, staff)
      // Map provider and doctor to practice-level view to show ALL practice orders
      const normalizedRole = (effectiveRole === 'provider' || effectiveRole === 'doctor') ? 'practice' : effectiveRole;
      
      if (normalizedRole === "admin" || normalizedRole === "practice" || normalizedRole === "staff") {
        console.time(`OrdersEdgeFunctionQuery-${normalizedRole}`);
        console.log(`[OrdersDataTable] Using edge function for role: ${normalizedRole}`);
        
        // Compute scopeId based on normalized role
        let scopeId: string | null = null;
        if (normalizedRole === 'practice') {
          // For doctors, effectivePracticeId may be null; use their own user id as practice id
          scopeId = effectivePracticeId || effectiveUserId;
          console.log(`[OrdersDataTable] Practice-level scopeId:`, scopeId);
        } else if (normalizedRole === 'staff') {
          // Staff: must use their practice_id
          if (!effectivePracticeId) {
            toast({
              title: "Configuration Error",
              description: "Practice context is missing. Please contact support.",
              variant: "destructive"
            });
            throw new Error('Missing practice context for staff user');
          }
          scopeId = effectivePracticeId;
          console.log(`[OrdersDataTable] Staff role - scopeId (practice_id):`, scopeId);
        }
        // Admin: scopeId remains null (no filter)
        
        console.log(`[OrdersDataTable] Invoking edge function:`, {
          roleNormalized: normalizedRole,
          scopeId,
          authUserId: user?.id
        });
        
        if (!session?.access_token) {
          toast({
            title: "Authentication Required",
            description: "No active session. Please log in again.",
            variant: "destructive"
          });
          throw new Error('No active session - please log in again');
        }
        
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke('get-orders-page', {
          body: {
            page: 1,
            pageSize: 50, // Reduced from 20 to 50 for better balance
            practiceId: scopeId,
            role: normalizedRole,
            status: undefined,
            search: undefined
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });
        console.timeEnd(`OrdersEdgeFunctionQuery-${effectiveRole}`);
        
        if (edgeError) {
          console.error('[OrdersDataTable] Edge function error:', edgeError);
          
          // Log detailed error for debugging
          if (edgeError.message?.includes('Unauthorized') || edgeError.message?.includes('401')) {
            console.error('[OrdersDataTable] 401 Unauthorized - token issue or RLS policy problem');
            toast({
              title: "Authorization Error",
              description: "Unable to authenticate request. Please refresh and try again.",
              variant: "destructive"
            });
          } else {
            toast({
              title: "Failed to Load Orders",
              description: edgeError.message || "Could not fetch orders. Please try again.",
              variant: "destructive"
            });
          }
          
          throw new Error(`Failed to load orders: ${edgeError.message || 'Unknown error'}`);
        }
        
        if (!edgeData || !Array.isArray(edgeData.orders)) {
          console.error('[OrdersDataTable] Invalid edge function response:', edgeData);
          toast({
            title: "Invalid Response",
            description: "Received invalid data from orders service.",
            variant: "destructive"
          });
          throw new Error('Invalid response from orders service');
        }
        
        console.log(`[OrdersDataTable] ✅ Edge function returned ${edgeData.orders.length} orders`);
        
        // Warn if edge function returns 0 orders (potential filtering issue)
        if (edgeData.orders.length === 0 && edgeData.total === 0) {
          console.warn('[OrdersDataTable] ⚠️ Edge function returned 0 orders - check filtering logic');
        }
        
        return edgeData.orders;
      }

      // For complex roles (pharmacy, provider, staff, topline, downline), use direct queries
      // For provider role, use edge function for consistency and performance
      if (effectiveRole === "provider") {
        console.log('[OrdersDataTable] Provider role - using edge function');
        
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke('get-orders-page', {
          body: {
            page: 1,
            pageSize: 1000, // Get all orders for provider
            practiceId: effectiveUserId,
            role: 'doctor', // Edge function maps this to provider logic
            status: undefined,
            search: undefined
          }
        });

        if (edgeError) {
          logger.error('Provider edge function error', edgeError);
          throw edgeError;
        }

        const queryDuration = Date.now() - queryStart;
        logger.info('Provider orders via edge function COMPLETE', { 
          duration: queryDuration,
          orderCount: edgeData?.orders?.length || 0
        });
        
        console.log(`[OrdersDataTable] Provider orders loaded: ${edgeData?.orders?.length || 0} orders`);
        
        return edgeData?.orders || [];
      }

      // Build base query for remaining roles (staff, topline, downline)
      let query = supabase
        .from("orders")
        .select(`
          id,
          created_at,
          total_amount,
          payment_status,
          status,
          status_manual_override,
          ship_to,
          doctor_id,
          order_lines(
            id,
            status,
            patient_name,
            patient_id,
            shipping_speed,
            tracking_number,
            products(name, product_types(name))
          ),
          profiles:doctor_id(name, company)
        `);

      // Filter by staff practice if role is staff
      if (effectiveRole === "staff") {
        // Get staff's practice_id from unified providers table
        const { data: staffData } = await supabase
          .from("providers")
          .select("practice_id")
          .eq("user_id", effectiveUserId)
          .eq("active", true)
          .maybeSingle();
        
        if (!staffData || !staffData.practice_id) {
          return []; // Staff record not found or inactive
        }
        
        // Filter orders by the staff member's practice
        query = query.eq("doctor_id", staffData.practice_id);
      }

      // Filter by downline rep if role is downline
      if (effectiveRole === "downline") {
        // Get the downline's rep record first
        const { data: downlineRep } = await supabase
          .from("reps")
          .select("id")
          .eq("user_id", effectiveUserId)
          .eq("role", "downline")
          .maybeSingle();
        
        if (!downlineRep) {
          setQueryMetadata({
            hasRepRecord: false,
            practiceCount: 0,
            practiceNames: [],
            isEmpty: true,
            emptyReason: 'no_rep'
          });
          return [];
        }
        
        // Get practices linked to this downline via rep_practice_links
        const { data: practiceLinks } = await supabase
          .from("rep_practice_links")
          .select("practice_id, profiles:practice_id(name)")
          .eq("rep_id", downlineRep.id);
        
        const practiceIds = practiceLinks?.map(pl => pl.practice_id) || [];
        const practiceNames = practiceLinks?.map(pl => (pl as any).profiles?.name).filter(Boolean) || [];
        
        if (practiceIds.length === 0) {
          setQueryMetadata({
            hasRepRecord: true,
            practiceCount: 0,
            practiceNames: [],
            isEmpty: true,
            emptyReason: 'no_practices'
          });
          return [];
        }
        
        // Store metadata for display
        setQueryMetadata({
          hasRepRecord: true,
          practiceCount: practiceIds.length,
          practiceNames,
          isEmpty: false,
          emptyReason: null
        });
        
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
        .order("created_at", { ascending: false })
        .limit(50); // OPTIMIZED: Reduced from 100 to 50 for better performance

      if (error) {
        logger.error('Orders query error', { 
          error: error.message || error, 
          code: error.code,
          details: error.details,
          hint: error.hint,
          effectiveRole, 
          effectiveUserId 
        });
        throw error;
      }
      
      const queryDuration = Date.now() - queryStart;
      console.timeEnd('OrdersQuery');
      logger.info('OrdersDataTable query COMPLETE', { 
        duration: queryDuration, 
        orderCount: data?.length || 0,
        effectiveRole 
      });
      
      if (queryDuration > 2000) {
        logger.warn('Slow orders query detected', { duration: queryDuration, orderCount: data?.length || 0 });
      }
      
      // CRITICAL: Filter out orders without order_lines (data integrity issue)
      const validOrders = (data || []).filter((order: any) => {
        const hasOrderLines = order.order_lines && order.order_lines.length > 0;
        if (!hasOrderLines) {
          logger.warn('Order missing order_lines - filtering out', { 
            orderId: order.id,
            orderTotal: order.total_amount,
            createdAt: order.created_at
          });
        }
        return hasOrderLines;
      });
      
      if (validOrders.length < (data?.length || 0)) {
        const orphanCount = (data?.length || 0) - validOrders.length;
        logger.warn('Filtered orphan orders', { 
          total: data?.length,
          valid: validOrders.length,
          orphaned: orphanCount
        });
      }
      
      // Update metadata if we got results for downline
      if (effectiveRole === "downline" && validOrders.length === 0 && queryMetadata.practiceCount > 0) {
        setQueryMetadata(prev => ({
          ...prev,
          isEmpty: true,
          emptyReason: 'no_orders'
        }));
      }
      
      return validOrders;
      } catch (error: any) {
        logger.error('Orders fetch failed', { 
          error: error.message || String(error), 
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          effectiveRole,
          effectiveUserId
        });
        toast({
          title: "Error loading orders",
          description: error?.message || "Unable to load orders. Please refresh or contact support.",
          variant: "destructive"
        });
        throw error;
      }
    },
    {
      staleTime: 0, // Always fetch fresh data - critical for orders appearing after checkout
      gcTime: 5 * 60 * 1000,
      refetchOnMount: true,
      refetchOnWindowFocus: false, // Don't refetch on tab switch (performance)
      refetchOnReconnect: true, // Refetch when reconnecting
      retry: 3, // Retry up to 3 times
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
      enabled: !!effectiveRole && !!effectiveUserId && !!user, // Only run when auth data is available
    },
    // Real-time event handler to immediately refetch on INSERT
    (payload) => {
      if (payload.eventType === 'INSERT') {
        console.log('[OrdersDataTable] Real-time INSERT detected, refetching orders');
        refetch();
      }
    }
  );

  // Fetch commission data - ONLY FOR ADMIN (reps should not see commission data)
  const { data: orderCommissions } = useQuery({
    queryKey: ["order-commissions", currentRepId, effectiveRole, orders],
    queryFn: async () => {
      if (!currentRepId || !orders?.length) return {};
      
      const orderIds = orders.map(o => o.id);
      
      const { data, error } = await supabase
        .from("order_profits")
        .select("order_id, topline_profit, downline_profit, product_id, products(requires_rx)")
        .in("order_id", orderIds);
      
      if (error) {
        logger.error('Commission fetch error', error);
        return {};
      }
      
      // Aggregate commissions by order_id
      const commissionMap: Record<string, { total: number; hasRx: boolean }> = {};
      
      data?.forEach((profit: any) => {
        if (!commissionMap[profit.order_id]) {
          commissionMap[profit.order_id] = { total: 0, hasRx: false };
        }
        
        // Add appropriate profit based on role
        const myProfit = effectiveRole === "topline" 
          ? (profit.topline_profit || 0) 
          : (profit.downline_profit || 0);
        
        commissionMap[profit.order_id].total += myProfit;
        
        // Track if any product requires RX
        if (profit.products?.requires_rx) {
          commissionMap[profit.order_id].hasRx = true;
        }
      });
      
      return commissionMap;
    },
    enabled: effectiveRole === 'admin' && !!currentRepId && !!orders?.length,
  });

  // Calculate counts for each status (including search filter)
  const statusCounts = useMemo(() => {
    if (!orders) return { all: 0 };
    
    const counts: Record<string, number> = {};
    
    // Count all orders that match search (regardless of status)
    const searchFilteredOrders = orders.filter((order) => {
      const searchLower = searchQuery.toLowerCase();
      return !searchQuery || 
        order.id.toLowerCase().includes(searchLower) || 
        order.profiles?.name?.toLowerCase().includes(searchLower) || 
        order.order_lines?.some((line: any) =>
          line.patient_name?.toLowerCase().includes(searchLower) || 
          line.products?.name?.toLowerCase().includes(searchLower) || 
          line.products?.product_types?.name?.toLowerCase().includes(searchLower) || 
          line.tracking_number?.toLowerCase().includes(searchLower)
        ) ||
        order.status.toLowerCase().includes(searchLower) || 
        order.payment_status.toLowerCase().includes(searchLower);
    });
    
    counts.all = searchFilteredOrders.length;
    
    // Count orders for each status config
    orderStatusConfigs?.forEach(config => {
      counts[config.status_key] = searchFilteredOrders.filter(order => 
        order.status === config.status_key ||
        order.order_lines?.some((line: any) => line.status === config.status_key)
      ).length || 0;
    });
    
    return counts;
  }, [orders, orderStatusConfigs, searchQuery]);

  const filteredOrders = orders?.filter((order) => {
    const searchLower = searchQuery.toLowerCase();
    
    // Enhanced multi-field search
    const matchesSearch = !searchQuery || 
      order.id.toLowerCase().includes(searchLower) || // Order ID
      order.profiles?.name?.toLowerCase().includes(searchLower) || // Doctor/Practice
      order.order_lines?.some((line: any) =>
        line.patient_name?.toLowerCase().includes(searchLower) || // Patient
        line.products?.name?.toLowerCase().includes(searchLower) || // Product name
        line.products?.product_types?.name?.toLowerCase().includes(searchLower) || // Product type
        line.tracking_number?.toLowerCase().includes(searchLower) // Tracking
      ) ||
      order.status.toLowerCase().includes(searchLower) || // Order status
      order.payment_status.toLowerCase().includes(searchLower); // Payment status
    
    // Filter by ORDER STATUS and shipping line statuses
    const matchesStatus =
      statusFilter === "all" ||
      order.status === statusFilter ||
      order.order_lines?.some((line: any) => line.status === statusFilter);
    
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
    itemsPerPage: 15 // OPTIMIZED: Reduced for faster initial load
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
    }
  };

  return (
    <div className="space-y-4">
      {/* Show practice scope info for downlines */}
      {effectiveRole === "downline" && queryMetadata.practiceCount > 0 && (
        <Alert>
          <AlertDescription className="text-sm">
            Showing orders from <strong>{queryMetadata.practiceCount}</strong> assigned practice{queryMetadata.practiceCount > 1 ? 's' : ''}
            {queryMetadata.practiceNames.length > 0 && (
              <>: {queryMetadata.practiceNames.join(', ')}</>
            )}
          </AlertDescription>
        </Alert>
      )}
      
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by order ID, patient, product, tracking..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue>
              {getStatusLabel(statusFilter, filteredOrders?.length || 0)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              All Order Statuses ({statusCounts.all || 0})
            </SelectItem>
            {orderStatusConfigs?.map((config) => (
              <SelectItem key={config.id} value={config.status_key}>
                {config.display_name} ({statusCounts[config.status_key] || 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border border-border bg-card overflow-x-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="min-w-[1600px]">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Patient Name</TableHead>
              <TableHead>Fulfillment Type</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Shipping Speed</TableHead>
              <TableHead>Shipping Status</TableHead>
              <TableHead>Order Status</TableHead>
              <TableHead>Payment Status</TableHead>
              {effectiveRole !== "pharmacy" && <TableHead>Total Amount</TableHead>}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={effectiveRole === "pharmacy" ? 10 : 11} className="text-center">
                  {!effectiveRole || !effectiveUserId ? "Initializing..." : "Loading orders..."}
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={effectiveRole === "pharmacy" ? 10 : (effectiveRole === "topline" || effectiveRole === "downline") ? 12 : 11} className="text-center">
                  <div className="py-8 space-y-2">
                    <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
                    <p className="text-sm font-medium">Unable to load orders</p>
                    <p className="text-xs text-muted-foreground">Please refresh the page or contact support if the issue persists</p>
                    <Button variant="outline" size="sm" onClick={() => refetch()}>
                      Try Again
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredOrders?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={effectiveRole === "pharmacy" ? 10 : (effectiveRole === "topline" || effectiveRole === "downline") ? 12 : 11} className="text-center">
                  <div className="py-8 space-y-2 text-muted-foreground">
                    {effectiveRole === "downline" && queryMetadata.emptyReason === 'no_rep' ? (
                      <>
                        <AlertTriangle className="h-8 w-8 mx-auto text-amber-500" />
                        <p className="text-sm font-medium text-foreground">Account Setup Incomplete</p>
                        <p className="text-xs">No representative record found for this account. Please contact admin to complete setup.</p>
                      </>
                    ) : effectiveRole === "downline" && queryMetadata.emptyReason === 'no_practices' ? (
                      <>
                        <AlertTriangle className="h-8 w-8 mx-auto text-amber-500" />
                        <p className="text-sm font-medium text-foreground">No Practices Assigned</p>
                        <p className="text-xs">No practices are linked to your account yet. Contact your topline or admin to assign practices.</p>
                      </>
                    ) : effectiveRole === "downline" && queryMetadata.emptyReason === 'no_orders' ? (
                      <>
                        <p className="text-sm font-medium text-foreground">No Orders Found</p>
                        <p className="text-xs">No orders found for your {queryMetadata.practiceCount} assigned practice{queryMetadata.practiceCount > 1 ? 's' : ''}. Try adjusting your search or filters.</p>
                      </>
                    ) : (
                      <p className="text-sm">No orders found</p>
                    )}
                  </div>
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
                  <TableRow 
                    key={order.id}
                    className={cn(
                      order.status === 'on_hold' && "bg-gold1/10 hover:bg-gold1/15"
                    )}
                  >
                    {/* Order ID */}
                    <TableCell className="font-medium">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </TableCell>

                    {/* Date */}
                    <TableCell>
                      {new Date(order.created_at).toLocaleDateString()}
                    </TableCell>

                    {/* Patient Name */}
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

                    {/* Fulfillment Type */}
                    <TableCell>
                      <Badge variant={order.ship_to === 'practice' ? 'secondary' : 'outline'}>
                        {order.ship_to === 'practice' ? '🏢 Practice' : '👤 Patient'}
                      </Badge>
                    </TableCell>

                    {/* Products */}
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

                    {/* Shipping Speed */}
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {order.order_lines?.[0]?.shipping_speed === '2day' ? '2-Day' : 
                         order.order_lines?.[0]?.shipping_speed === 'overnight' ? 'Overnight' : 
                         'Ground'}
                      </Badge>
                    </TableCell>

                    {/* Shipping Status */}
                    <TableCell>
                      <Badge className={getStatusColor(shippingStatus)}>
                        {shippingStatus === "mixed" ? "Mixed" : shippingStatus}
                      </Badge>
                    </TableCell>

                    {/* Order Status (WITH ALERT ICON) */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {order.status === 'on_hold' && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertTriangle className="h-4 w-4 text-yellow-600 animate-pulse" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Order on hold by pharmacy</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <Badge className={getStatusColor(order.status)}>
                          {order.status}
                        </Badge>
                        {order.status_manual_override && (
                          <Badge variant="outline" className="text-xs">Manual</Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* Payment Status */}
                    <TableCell>
                      <Badge className={getPaymentStatusColor(order.payment_status)}>
                        {getPaymentStatusLabel(order.payment_status)}
                      </Badge>
                    </TableCell>

                    {/* Total Amount (if not pharmacy) */}
                    {effectiveRole !== "pharmacy" && (
                      <TableCell>${order.total_amount}</TableCell>
                    )}

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {/* View Details Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedOrder(order);
                            setDetailsOpen(true);
                          }}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        {/* Download Receipt Button (practice staff, pharmacy, admin only - NOT reps) */}
                        {effectiveRole !== "pharmacy" && 
                         effectiveRole !== "topline" && 
                         effectiveRole !== "downline" && (
                          <ReceiptDownloadButton
                            orderId={order.id}
                            orderDate={order.created_at}
                            practiceName={order.profiles?.name || "Practice"}
                          />
                        )}

                        {/* Download Prescription Button (practice staff, pharmacy, admin only - NOT reps) */}
                        {effectiveRole !== "pharmacy" && 
                         effectiveRole !== "topline" && 
                         effectiveRole !== "downline" && 
                         order.order_lines?.some((line: any) => line.prescription_url) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const lineWithRx = order.order_lines?.find((l: any) => l.prescription_url);
                              if (lineWithRx) {
                                handlePrescriptionDownload(
                                  lineWithRx.prescription_url,
                                  lineWithRx.products?.name || 'prescription'
                                );
                              }
                            }}
                            title="Download Prescription"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
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
