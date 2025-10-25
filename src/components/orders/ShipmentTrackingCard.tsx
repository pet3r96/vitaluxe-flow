import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { getCurrentCSRFToken } from "@/lib/csrf";
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
  canEdit?: boolean;
  onUpdate?: () => void;
}

export const ShipmentTrackingCard = ({ 
  orderLineId, 
  trackingNumber, 
  carrier,
  canEdit = false,
  onUpdate
}: ShipmentTrackingCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editTrackingNumber, setEditTrackingNumber] = useState(trackingNumber || "");
  const [editCarrier, setEditCarrier] = useState(carrier || "");

  // Fetch tracking information
  const { data: tracking, isLoading, refetch } = useQuery({
    queryKey: ["shipment-tracking", orderLineId, trackingNumber, carrier],
    queryFn: async () => {
      if (!trackingNumber) return null;

      const csrfToken = await getCurrentCSRFToken();
      if (!csrfToken) {
        throw new Error("Unable to verify session");
      }

      const { data, error } = await supabase.functions.invoke("get-easypost-tracking", {
        body: { tracking_code: trackingNumber, carrier: carrier },
        headers: {
          'x-csrf-token': csrfToken
        }
      });

      if (error) throw error;
      return data.tracking;
    },
    enabled: !!trackingNumber,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnMount: false, // Don't refetch when component remounts
    retry: 1, // Only retry once on failure
    retryDelay: 2000, // Wait 2 seconds before retry
  });

  // Fetch tracking events from database
  const { data: trackingEvents } = useQuery({
    queryKey: ["tracking-events", orderLineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("easypost_tracking_events" as any)
        .select("*")
        .eq("order_line_id", orderLineId)
        .order("event_time", { ascending: false });

      if (error) throw error;
      if (!data) return [];
      
      // Map event_time to datetime for consistent property names
      return data.map((e: any) => ({ 
        ...e, 
        datetime: e.event_time 
      })) as TrackingEvent[];
    },
    enabled: !!orderLineId,
  });

  // Refresh tracking mutation
  const refreshTrackingMutation = useMutation({
    mutationFn: async () => {
      if (!trackingNumber) throw new Error("No tracking number available");
      
      const csrfToken = await getCurrentCSRFToken();
      if (!csrfToken) {
        throw new Error("Unable to verify session");
      }
      
      const { data, error } = await supabase.functions.invoke("get-easypost-tracking", {
        body: { tracking_code: trackingNumber, carrier: carrier },
        headers: {
          'x-csrf-token': csrfToken
        }
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

  // Save tracking changes mutation
  const saveTrackingMutation = useMutation({
    mutationFn: async () => {
      if (!editTrackingNumber.trim()) {
        throw new Error("Tracking number is required");
      }
      if (!editCarrier) {
        throw new Error("Carrier is required");
      }

      const csrfToken = await getCurrentCSRFToken();
      if (!csrfToken) {
        throw new Error("Unable to verify session");
      }

      const { data, error } = await supabase.functions.invoke("update-shipping-info", {
        body: {
          orderLineId: orderLineId,
          trackingNumber: editTrackingNumber.trim(),
          carrier: editCarrier.toLowerCase(),
        },
        headers: {
          'x-csrf-token': csrfToken
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Tracking information updated");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["shipment-tracking", orderLineId] });
      queryClient.invalidateQueries({ queryKey: ["tracking-events", orderLineId] });
      queryClient.invalidateQueries({ queryKey: ["order-shipping-details"] });
      queryClient.invalidateQueries({ queryKey: ["pharmacy-assigned-orders"] });
      if (onUpdate) onUpdate();
      
      // Trigger automatic refresh after save
      setTimeout(() => refetch(), 500);
    },
    onError: (error: any) => {
      toast.error(`Failed to update tracking: ${error.message}`);
    }
  });

  const getStatusIcon = (status: string) => {
    if (!status) return <AlertCircle className="h-4 w-4 text-red-500" />;
    
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
    if (!status) {
      return <Badge variant="outline" className="bg-amber-100 text-amber-800"><Package className="h-3 w-3 mr-1" />Awaiting Updates</Badge>;
    }
    
    switch (status.toLowerCase()) {
      case "delivered":
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Delivered</Badge>;
      case "in_transit":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800"><Truck className="h-3 w-3 mr-1" />In Transit</Badge>;
      case "pre_transit":
        return <Badge variant="outline" className="bg-amber-100 text-amber-800"><Package className="h-3 w-3 mr-1" />Awaiting Carrier Updates</Badge>;
      case "unknown":
        return <Badge variant="outline" className="bg-amber-100 text-amber-800"><Package className="h-3 w-3 mr-1" />Awaiting Carrier Updates</Badge>;
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
          
          {!isEditing ? (
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="font-mono text-sm">
                {trackingNumber}
              </Badge>
              {carrier && (
                <Badge variant="outline">
                  {carrier}
                </Badge>
              )}
              
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditTrackingNumber(trackingNumber || "");
                    setEditCarrier(carrier || "");
                    setIsEditing(true);
                  }}
                >
                  Edit
                </Button>
              )}
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => refreshTrackingMutation.mutate()}
                disabled={refreshTrackingMutation.isPending || isLoading}
              >
                {refreshTrackingMutation.isPending || isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
              </Button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsEditing(false);
                  setEditTrackingNumber(trackingNumber || "");
                  setEditCarrier(carrier || "");
                }}
                disabled={saveTrackingMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => saveTrackingMutation.mutate()}
                disabled={saveTrackingMutation.isPending || !editTrackingNumber.trim() || !editCarrier}
              >
                {saveTrackingMutation.isPending ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Saving
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-tracking">Tracking Number</Label>
              <Input
                id="edit-tracking"
                value={editTrackingNumber}
                onChange={(e) => setEditTrackingNumber(e.target.value)}
                placeholder="Enter tracking number"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-carrier">Carrier</Label>
              <Select value={editCarrier} onValueChange={setEditCarrier}>
                <SelectTrigger id="edit-carrier">
                  <SelectValue placeholder="Select carrier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USPS">USPS</SelectItem>
                  <SelectItem value="UPS">UPS</SelectItem>
                  <SelectItem value="FedEx">FedEx</SelectItem>
                  <SelectItem value="DHL">DHL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Use EasyPost Test Codes</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditTrackingNumber("EZ1000000001");
                    setEditCarrier("USPS");
                  }}
                >
                  Pre-Transit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditTrackingNumber("EZ1000000002");
                    setEditCarrier("USPS");
                  }}
                >
                  In Transit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditTrackingNumber("EZ1000000003");
                    setEditCarrier("USPS");
                  }}
                >
                  Delivered
                </Button>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground">
              Changes will update the tracking information and refresh tracking data.
            </p>
          </div>
        ) : (
          isLoading ? (
            <div className="text-center py-4">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground mt-2">Loading tracking information...</p>
            </div>
          ) : tracking ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(tracking.status)}
                    <span className="font-medium">Current Status</span>
                  </div>
                  {canEdit && tracking.events && (
                    <p className="text-xs text-muted-foreground ml-6">
                      Events received: {tracking.events.length}
                    </p>
                  )}
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
                onClick={() => {
                  // Add small delay to avoid duplicate in-flight requests
                  setTimeout(() => refetch(), 1000);
                }}
                className="mt-2"
                disabled={isLoading}
              >
                Try Again
              </Button>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
};
