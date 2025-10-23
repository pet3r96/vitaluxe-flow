import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  RefreshCw, 
  Package, 
  Truck, 
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TrackingEvent {
  status: string;
  message: string;
  description: string;
  carrier: string;
  tracking_details: any;
  datetime: string;
}

interface ShipmentTrackingCardProps {
  orderLineId: string;
  trackingNumber?: string;
  carrier?: string;
}

export const ShipmentTrackingCard = ({ 
  orderLineId, 
  trackingNumber, 
  carrier 
}: ShipmentTrackingCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  // Fetch tracking information
  const { data: tracking, isLoading, refetch } = useQuery({
    queryKey: ["shipment-tracking", orderLineId],
    queryFn: async () => {
      if (!trackingNumber) return null;

      const { data, error } = await supabase.functions.invoke("get-easypost-tracking", {
        body: { tracking_code: trackingNumber }
      });

      if (error) throw error;
      return data.tracking;
    },
    enabled: !!trackingNumber,
    refetchInterval: 300000, // Refetch every 5 minutes
  });

  // Fetch tracking events from database
  const { data: trackingEvents } = useQuery({
    queryKey: ["tracking-events", orderLineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("easypost_tracking_events")
        .select("*")
        .eq("order_line_id", orderLineId)
        .order("event_time", { ascending: false });

      if (error) throw error;
      return data as TrackingEvent[];
    },
    enabled: !!orderLineId,
  });

  // Refresh tracking mutation
  const refreshTrackingMutation = useMutation({
    mutationFn: async () => {
      if (!trackingNumber) throw new Error("No tracking number available");
      
      const { data, error } = await supabase.functions.invoke("get-easypost-tracking", {
        body: { tracking_code: trackingNumber }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Tracking information updated");
      queryClient.invalidateQueries({ queryKey: ["shipment-tracking", orderLineId] });
      queryClient.invalidateQueries({ queryKey: ["tracking-events", orderLineId] });
    },
    onError: (error: any) => {
      toast.error(`Failed to refresh tracking: ${error.message}`);
    }
  });

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "delivered":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "in_transit":
        return <Truck className="h-4 w-4 text-blue-500" />;
      case "pre_transit":
        return <Package className="h-4 w-4 text-gray-500" />;
      case "unknown":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "delivered":
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Delivered</Badge>;
      case "in_transit":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800"><Truck className="h-3 w-3 mr-1" />In Transit</Badge>;
      case "pre_transit":
        return <Badge variant="outline" className="bg-gray-100 text-gray-800"><Package className="h-3 w-3 mr-1" />Pre Transit</Badge>;
      case "unknown":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Unknown</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString();
  };

  if (!trackingNumber) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Package className="h-5 w-5 mr-2" />
            Shipment Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-4">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No tracking information available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <Package className="h-5 w-5 mr-2" />
            Shipment Tracking
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="font-mono text-sm">
              {trackingNumber}
            </Badge>
            {carrier && (
              <Badge variant="outline">
                {carrier}
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => refreshTrackingMutation.mutate()}
              disabled={refreshTrackingMutation.isPending}
            >
              {refreshTrackingMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground mt-2">Loading tracking information...</p>
          </div>
        ) : tracking ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {getStatusIcon(tracking.status)}
                <span className="font-medium">Current Status</span>
              </div>
              {getStatusBadge(tracking.status)}
            </div>

            {tracking.tracking_url && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => window.open(tracking.tracking_url, '_blank')}
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Track on {carrier || 'Carrier'} Website
                </Button>
              </div>
            )}

            {expanded && (
              <div className="space-y-4">
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Tracking History</h4>
                  {trackingEvents && trackingEvents.length > 0 ? (
                    <div className="space-y-3">
                      {trackingEvents.map((event, index) => (
                        <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                          <div className="flex-shrink-0 mt-1">
                            {getStatusIcon(event.status)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium">{event.status}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(event.datetime)}
                              </p>
                            </div>
                            {event.message && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {event.message}
                              </p>
                            )}
                            {event.description && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {event.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-4">
                      <Clock className="h-6 w-6 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No tracking events available</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? "Hide Details" : "Show Details"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-4">
            <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p>Unable to load tracking information</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              className="mt-2"
            >
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
