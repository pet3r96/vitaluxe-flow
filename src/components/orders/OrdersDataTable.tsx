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
    ["orders", effectiveRole, effectiveUserId, effectivePracticeId],
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

      // USE SINGLE EDGE FUNCTION FOR ALL ROLES
      if (["admin", "practice", "doctor", "provider", "staff", "pharmacy", "topline", "downline"].includes(effectiveRole)) {
        console.time(`OrdersEdgeFunctionQuery-${effectiveRole}`);
        console.log(`[OrdersDataTable] Using edge function for role: ${effectiveRole}`);
        
        // Compute scopeId based on actual role (NO NORMALIZATION)
        let scopeId: string | null = null;
        if (effectiveRole === "doctor" || effectiveRole === "practice") {
          // Practice owner / doctor – use practice ID if available, otherwise fallback to userId
          scopeId = effectivePracticeId || effectiveUserId;
          console.log(`[OrdersDataTable] Practice-level scopeId:`, scopeId);
        } else if (effectiveRole === "staff") {
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
        } else if (effectiveRole === "topline" || effectiveRole === "downline") {
          // For reps, scopeId is their own user ID (edge function will lookup rep record)
          scopeId = effectiveUserId;
          console.log(`[OrdersDataTable] ${effectiveRole} role - scopeId:`, scopeId);
        } else if (effectiveRole === "provider") {
          // Provider – use their user ID; edge function will look up provider record
          scopeId = effectiveUserId;
          console.log(`[OrdersDataTable] Provider role - scopeId:`, scopeId);
        } else if (effectiveRole === "pharmacy") {
          // Pharmacy – use their user ID; edge function will look up pharmacy record
          scopeId = effectiveUserId;
          console.log(`[OrdersDataTable] Pharmacy role - scopeId:`, scopeId);
        }
        // Admin: scopeId remains null (no filter)
        
        console.log(`[OrdersDataTable] Invoking edge function:`, {
          role: effectiveRole,
          scopeId,
          authUserId: user?.id,
          statusFilter,
          searchQuery
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
            pageSize: 50,
            practiceId: scopeId,
            role: effectiveRole, // Send actual role, no normalization
            status: statusFilter !== 'all' ? statusFilter : undefined,
            search: searchQuery || undefined
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

      // ALL ROLES NOW USE UNIFIED EDGE FUNCTION - NO FALLBACK NEEDED
      
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
      staleTime: 30000, // 30 second cache - prevents excessive fetches on filter changes // Always fetch fresh data - critical for orders appearing after checkout
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
      toast({
        title: "Downloading prescription...",
        description: "Please wait"
      });

      const response = await fetch(prescriptionUrl);
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Prescription link has expired. Please contact support to regenerate.');
        }
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

      toast({
        title: "Download Complete",
        description: `${productName} prescription downloaded successfully`
      });
    } catch (error: any) {
      logger.error('Prescription download error', error);
      toast({
        title: "Download Failed",
        description: error.message || "Unable to download prescription",
        variant: "destructive"
      });
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

                        {/* Script Action - doctors/providers/pharmacy/admin only */}
                        {(() => {
                          const hasAnyScript = order.order_lines?.some((l: any) =>
                            Boolean(l.prescription_url) ||
                            Boolean(l.prescription_url_encrypted) ||
                            Boolean(l.prescription_url_indicator) ||
                            Boolean(l.products?.requires_prescription)
                          );
                          
                          if (!["doctor", "provider", "pharmacy", "admin"].includes(effectiveRole || "") || !hasAnyScript) {
                            return null;
                          }

                          const directUrl = order.order_lines?.find((l: any) => l.prescription_url)?.prescription_url;
                          
                          return (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      if (directUrl) {
                                        const line = order.order_lines.find((l: any) => l.prescription_url);
                                        handlePrescriptionDownload(directUrl, line?.products?.name || 'prescription');
                                      } else {
                                        setSelectedOrder(order);
                                        setDetailsOpen(true);
                                      }
                                    }}
                                    className="h-8 px-2"
                                    aria-label="View prescription"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Script</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })()}
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
