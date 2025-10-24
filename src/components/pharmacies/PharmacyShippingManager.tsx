import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PharmacyShippingWorkflow } from "./PharmacyShippingWorkflow";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, CheckCircle, XCircle, List } from "lucide-react";
import { toast } from "sonner";

type OrderStatus = 'pending' | 'processing' | 'shipped' | 'denied' | 'all';

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

  // Fetch assigned orders
  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ['pharmacy-assigned-orders', pharmacyData?.id, activeTab],
    queryFn: async () => {
      if (!pharmacyData?.id) return [];

      let query = supabase
        .from('order_lines')
        .select(`
          id,
          order_id,
          status,
          tracking_number,
          shipping_carrier,
          shipped_at,
          patient_name,
          created_at,
          order_notes,
          orders (
            id,
            created_at,
            total_amount,
            ship_to,
            profiles (
              id,
              name,
              company
            )
          )
        `)
        .eq('assigned_pharmacy_id', pharmacyData.id)
        .order('created_at', { ascending: false });

      // Filter by tab
      if (activeTab === 'pending') {
        query = query.in('status', ['pending', 'filled']);
      } else if (activeTab === 'shipped') {
        query = query.eq('status', 'shipped');
      } else if (activeTab === 'denied') {
        query = query.eq('status', 'denied');
      }

      const { data, error } = await query;
      
      if (error) {
        toast.error('Failed to load orders');
        throw error;
      }
      
      return data;
    },
    enabled: !!pharmacyData?.id,
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'default',
      processing: 'secondary',
      filled: 'secondary',
      shipped: 'outline',
      denied: 'destructive',
    };

    return (
      <Badge variant={variants[status] || 'default'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getCounts = () => {
    if (!orders) return { pending: 0, shipped: 0, denied: 0, all: 0 };
    
    // We need to fetch all orders to get accurate counts
    return {
      pending: orders.filter(o => ['pending', 'filled'].includes(o.status)).length,
      shipped: orders.filter(o => o.status === 'shipped').length,
      denied: orders.filter(o => o.status === 'denied').length,
      all: orders.length,
    };
  };

  const counts = getCounts();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <div className="lg:col-span-2">
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as OrderStatus)} className="mb-6">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Package className="h-4 w-4" />
            Pending {counts.pending > 0 && `(${counts.pending})`}
          </TabsTrigger>
          <TabsTrigger value="shipped" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Shipped {counts.shipped > 0 && `(${counts.shipped})`}
          </TabsTrigger>
          <TabsTrigger value="denied" className="gap-2">
            <XCircle className="h-4 w-4" />
            Declined {counts.denied > 0 && `(${counts.denied})`}
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2">
            <List className="h-4 w-4" />
            All
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Sidebar - Order List */}
        <div className="lg:col-span-1 space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
          {!orders || orders.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                {activeTab === 'pending' && 'No pending orders'}
                {activeTab === 'shipped' && 'No shipped orders'}
                {activeTab === 'denied' && 'No declined orders - great job!'}
                {activeTab === 'all' && 'No orders assigned to you yet'}
              </p>
            </Card>
          ) : (
            orders.map((orderLine) => (
              <Card
                key={orderLine.id}
                className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                  selectedOrderId === orderLine.order_id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedOrderId(orderLine.order_id)}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">
                      Order #{orderLine.order_id.slice(0, 8)}
                    </p>
                    {getStatusBadge(orderLine.status)}
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    Patient: {orderLine.patient_name}
                  </p>
                  
                  <p className="text-sm text-muted-foreground">
                    Practice: {orderLine.orders?.profiles?.company || orderLine.orders?.profiles?.name}
                  </p>
                  
                  <p className="text-xs text-muted-foreground">
                    {new Date(orderLine.created_at).toLocaleDateString()}
                  </p>

                  {orderLine.tracking_number && (
                    <p className="text-xs font-mono bg-muted px-2 py-1 rounded">
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
            <Card className="p-12 text-center">
              <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Select an order to begin</p>
              <p className="text-sm text-muted-foreground mt-2">
                Click on an order from the list to view details and process shipment
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
