import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PharmacyShippingWorkflow } from "./PharmacyShippingWorkflow";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, CheckCircle, XCircle, List, Clock } from "lucide-react";
import { toast } from "sonner";

type OrderStatus = 'pending' | 'processing' | 'shipped' | 'denied' | 'on_hold' | 'all';

export const PharmacyShippingManager = () => {
  const { user, effectiveUserId } = useAuth();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<OrderStatus>('pending');

  // Fetch pharmacy user_id
  const { data: pharmacyData } = useQuery({
    queryKey: ['pharmacy-user', effectiveUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pharmacies')
        .select('id, user_id, name')
        .eq('user_id', effectiveUserId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveUserId,
  });

  // Fetch ALL assigned orders (no status filter)
  const { data: allOrders, isLoading, refetch } = useQuery({
    queryKey: ['pharmacy-assigned-orders', pharmacyData?.id],
    queryFn: async () => {
      if (!pharmacyData?.id) return [];

      // OPTIMIZED: Only fetch fields needed for list display + limit to most recent 50
      const { data, error } = await supabase
        .from('order_lines')
        .select(`
          id,
          order_id,
          status,
          tracking_number,
          patient_name,
          created_at,
          orders!inner (
            id,
            created_at,
            payment_status,
            profiles (
              name,
              company
            )
          )
        `)
        .eq('assigned_pharmacy_id', pharmacyData.id)
        .neq('orders.payment_status', 'payment_failed')
        .order('created_at', { ascending: false })
        .limit(50); // Reduced to 50 for faster initial load
      
      if (error) {
        toast.error('Failed to load orders');
        throw error;
      }
      
      return data || [];
    },
    enabled: !!pharmacyData?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes - reduced refetch frequency
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Early loading state for better UX
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  // Filter orders based on active tab (client-side)
  const filteredOrders = useMemo(() => {
    if (!allOrders) return [];

    if (activeTab === 'all') return allOrders;

    if (activeTab === 'pending') {
      return allOrders.filter(o => ['pending', 'filled'].includes(o.status));
    }
    if (activeTab === 'shipped') {
      return allOrders.filter(o => o.status === 'shipped');
    }
    if (activeTab === 'denied') {
      return allOrders.filter(o => o.status === 'denied');
    }
    if (activeTab === 'on_hold') {
      return allOrders.filter(o => o.status === 'on_hold');
    }

    return allOrders;
  }, [allOrders, activeTab]);

  // Clear selection when filtered orders change or active tab changes
  useEffect(() => {
    // Case 1: No orders for current filter
    if (!filteredOrders || filteredOrders.length === 0) {
      setSelectedOrderId(null);
      return;
    }
    
    // Case 2: Selected order not in current filtered list
    if (selectedOrderId && !filteredOrders.some(o => o.order_id === selectedOrderId)) {
      setSelectedOrderId(null);
    }
  }, [filteredOrders, activeTab, selectedOrderId]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'default',
      processing: 'secondary',
      filled: 'secondary',
      shipped: 'outline',
      denied: 'destructive',
      on_hold: 'outline',
    };

    const label = status === 'on_hold' ? 'On Hold' : status.charAt(0).toUpperCase() + status.slice(1);

    return (
      <Badge variant={variants[status] || 'default'} className={status === 'on_hold' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' : ''}>
        {label}
      </Badge>
    );
  };

  const getCounts = () => {
    if (!allOrders) return { pending: 0, shipped: 0, denied: 0, on_hold: 0, all: 0 };
    
    return {
      pending: allOrders.filter(o => ['pending', 'filled'].includes(o.status)).length,
      shipped: allOrders.filter(o => o.status === 'shipped').length,
      denied: allOrders.filter(o => o.status === 'denied').length,
      on_hold: allOrders.filter(o => o.status === 'on_hold').length,
      all: allOrders.length,
    };
  };

  const counts = getCounts();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-1 space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 sm:h-32 w-full" />
          ))}
        </div>
        <div className="lg:col-span-2">
          <Skeleton className="h-64 sm:h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as OrderStatus)} className="mb-4 sm:mb-6">
        <TabsList className="flex-wrap h-auto gap-1 sm:gap-0">
          <TabsTrigger value="pending" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
            <Package className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Pending</span>
            <span className="sm:hidden">Pend.</span>
            {counts.pending > 0 && `(${counts.pending})`}
          </TabsTrigger>
          <TabsTrigger value="on_hold" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
            <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">On Hold</span>
            <span className="sm:hidden">Hold</span>
            {counts.on_hold > 0 && `(${counts.on_hold})`}
          </TabsTrigger>
          <TabsTrigger value="shipped" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
            <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Shipped</span>
            <span className="sm:hidden">Ship.</span>
            {counts.shipped > 0 && `(${counts.shipped})`}
          </TabsTrigger>
          <TabsTrigger value="denied" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
            <XCircle className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Declined</span>
            <span className="sm:hidden">Decl.</span>
            {counts.denied > 0 && `(${counts.denied})`}
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
            <List className="h-3 w-3 sm:h-4 sm:w-4" />
            All
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Sidebar - Order List */}
        <div className="lg:col-span-1 space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
          {!filteredOrders || filteredOrders.length === 0 ? (
            <Card className="p-6 sm:p-8 text-center">
              <p className="text-sm sm:text-base text-muted-foreground">
                {activeTab === 'pending' && 'No pending orders'}
                {activeTab === 'on_hold' && 'No orders on hold'}
                {activeTab === 'shipped' && 'No shipped orders'}
                {activeTab === 'denied' && 'No declined orders - great job!'}
                {activeTab === 'all' && 'No orders assigned to you yet'}
              </p>
            </Card>
          ) : (
            filteredOrders.map((orderLine) => (
              <Card
                key={orderLine.id}
                className={`p-3 sm:p-4 cursor-pointer transition-all hover:shadow-md ${
                  selectedOrderId === orderLine.order_id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedOrderId(orderLine.order_id)}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-xs sm:text-sm truncate">
                      Order #{orderLine.order_id.slice(0, 8)}
                    </p>
                    {getStatusBadge(orderLine.status)}
                  </div>
                  
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">
                    Patient: {orderLine.patient_name}
                  </p>
                  
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">
                    Practice: {orderLine.orders?.profiles?.company || orderLine.orders?.profiles?.name}
                  </p>
                  
                  <p className="text-xs text-muted-foreground">
                    {new Date(orderLine.created_at).toLocaleDateString()}
                  </p>

                  {orderLine.tracking_number && (
                    <p className="text-xs font-mono bg-muted px-2 py-1 rounded truncate">
                      {orderLine.tracking_number}
                    </p>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Right Panel - Workflow */}
        <div className="lg:col-span-2">
          {selectedOrderId ? (
            <PharmacyShippingWorkflow 
              orderId={selectedOrderId} 
              onUpdate={refetch}
              onClose={() => setSelectedOrderId(null)}
            />
          ) : (
            <Card className="p-8 sm:p-12 text-center">
              <Package className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-base sm:text-lg font-medium">Select an order to begin</p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                Click on an order from the list to view details and process shipment
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
