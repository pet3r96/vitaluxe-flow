import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Loader2, 
  RefreshCw, 
  Package, 
  Truck, 
  ExternalLink,
  Plus,
  Search,
  AlertCircle,
  CheckCircle2
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Shipment {
  id: string;
  easypost_shipment_id: string;
  order_line_id: string;
  tracking_code: string;
  carrier: string;
  service: string;
  status: string;
  label_url: string;
  tracking_url: string;
  rate: number;
  created_at: string;
  order_lines: {
    id: string;
    patient_name: string;
    patient_address: string;
    status: string;
  };
}

interface CreateShipmentData {
  order_line_id: string;
  from_address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    name?: string;
    company?: string;
  };
  to_address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    name?: string;
    company?: string;
  };
  parcel?: {
    length: number;
    width: number;
    height: number;
    weight: number;
  };
}

export const EasyPostShipmentManager = () => {
  const [selectedOrderLine, setSelectedOrderLine] = useState<string>("");
  const [createShipmentOpen, setCreateShipmentOpen] = useState(false);
  const [createShipmentData, setCreateShipmentData] = useState<CreateShipmentData>({
    order_line_id: "",
    from_address: {
      street: "",
      city: "",
      state: "",
      zip: "",
      name: "",
      company: ""
    },
    to_address: {
      street: "",
      city: "",
      state: "",
      zip: "",
      name: "",
      company: ""
    },
    parcel: {
      length: 10,
      width: 8,
      height: 4,
      weight: 1
    }
  });

  const queryClient = useQueryClient();

  // Fetch all shipments
  const { data: shipments, isLoading, refetch } = useQuery({
    queryKey: ["easypost-shipments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("easypost_shipments")
        .select(`
          *,
          order_lines!inner(
            id,
            patient_name,
            patient_address,
            status
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Shipment[];
    },
  });

  // Fetch order lines without shipments
  const { data: availableOrderLines } = useQuery({
    queryKey: ["order-lines-without-shipments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_lines")
        .select(`
          id,
          patient_name,
          patient_address,
          status,
          assigned_pharmacy_id,
          pharmacies!inner(
            name,
            address_street,
            address_city,
            address_state,
            address_zip
          )
        `)
        .is("easypost_shipment_id", null)
        .in("status", ["filled", "shipped"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Create shipment mutation
  const createShipmentMutation = useMutation({
    mutationFn: async (data: CreateShipmentData) => {
      const { data: result, error } = await supabase.functions.invoke("create-easypost-shipment", {
        body: data
      });

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast.success("Shipment created successfully");
      queryClient.invalidateQueries({ queryKey: ["easypost-shipments"] });
      queryClient.invalidateQueries({ queryKey: ["order-lines-without-shipments"] });
      setCreateShipmentOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to create shipment: ${error.message}`);
    }
  });

  // Get tracking mutation
  const getTrackingMutation = useMutation({
    mutationFn: async (trackingCode: string) => {
      const { data: result, error } = await supabase.functions.invoke("get-easypost-tracking", {
        body: { tracking_code: trackingCode }
      });

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      toast.success("Tracking information updated");
      queryClient.invalidateQueries({ queryKey: ["easypost-shipments"] });
    },
    onError: (error: any) => {
      toast.error(`Failed to get tracking: ${error.message}`);
    }
  });

  const handleCreateShipment = () => {
    if (!createShipmentData.order_line_id) {
      toast.error("Please select an order line");
      return;
    }

    createShipmentMutation.mutate(createShipmentData);
  };

  const handleRefreshTracking = (trackingCode: string) => {
    getTrackingMutation.mutate(trackingCode);
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "delivered":
        return <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1" />Delivered</Badge>;
      case "in_transit":
        return <Badge variant="secondary"><Truck className="h-3 w-3 mr-1" />In Transit</Badge>;
      case "pre_transit":
        return <Badge variant="outline"><Package className="h-3 w-3 mr-1" />Pre Transit</Badge>;
      case "unknown":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Unknown</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatAddress = (address: string) => {
    if (!address) return "N/A";
    return address.length > 50 ? `${address.substring(0, 50)}...` : address;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">EasyPost Shipment Manager</h2>
          <p className="text-muted-foreground">Manage shipments and tracking</p>
        </div>
        <Dialog open={createShipmentOpen} onOpenChange={setCreateShipmentOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Shipment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Shipment</DialogTitle>
              <DialogDescription>
                Create a new EasyPost shipment for an order line
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="order-line">Order Line</Label>
                <Select
                  value={createShipmentData.order_line_id}
                  onValueChange={(value) => {
                    setCreateShipmentData(prev => ({ ...prev, order_line_id: value }));
                    const orderLine = availableOrderLines?.find(ol => ol.id === value);
                    if (orderLine) {
                      // Parse patient address
                      const patientAddressParts = orderLine.patient_address?.split(',') || [];
                      const patientStreet = patientAddressParts[0]?.trim() || '';
                      const patientCityStateZip = patientAddressParts[1]?.trim() || '';
                      const patientCity = patientCityStateZip.split(' ')[0] || '';
                      const patientState = patientCityStateZip.split(' ')[1] || '';
                      const patientZip = patientCityStateZip.split(' ')[2] || '';

                      setCreateShipmentData(prev => ({
                        ...prev,
                        to_address: {
                          street: patientStreet,
                          city: patientCity,
                          state: patientState,
                          zip: patientZip,
                          name: orderLine.patient_name
                        },
                        from_address: {
                          street: orderLine.pharmacies.address_street || '',
                          city: orderLine.pharmacies.address_city || '',
                          state: orderLine.pharmacies.address_state || '',
                          zip: orderLine.pharmacies.address_zip || '',
                          name: orderLine.pharmacies.name
                        }
                      }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select order line" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableOrderLines?.map((orderLine) => (
                      <SelectItem key={orderLine.id} value={orderLine.id}>
                        {orderLine.patient_name} - {orderLine.pharmacies.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>From Address</Label>
                  <div className="space-y-2">
                    <Input
                      placeholder="Street"
                      value={createShipmentData.from_address.street}
                      onChange={(e) => setCreateShipmentData(prev => ({
                        ...prev,
                        from_address: { ...prev.from_address, street: e.target.value }
                      }))}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="City"
                        value={createShipmentData.from_address.city}
                        onChange={(e) => setCreateShipmentData(prev => ({
                          ...prev,
                          from_address: { ...prev.from_address, city: e.target.value }
                        }))}
                      />
                      <Input
                        placeholder="State"
                        value={createShipmentData.from_address.state}
                        onChange={(e) => setCreateShipmentData(prev => ({
                          ...prev,
                          from_address: { ...prev.from_address, state: e.target.value }
                        }))}
                      />
                    </div>
                    <Input
                      placeholder="ZIP"
                      value={createShipmentData.from_address.zip}
                      onChange={(e) => setCreateShipmentData(prev => ({
                        ...prev,
                        from_address: { ...prev.from_address, zip: e.target.value }
                      }))}
                    />
                  </div>
                </div>

                <div>
                  <Label>To Address</Label>
                  <div className="space-y-2">
                    <Input
                      placeholder="Street"
                      value={createShipmentData.to_address.street}
                      onChange={(e) => setCreateShipmentData(prev => ({
                        ...prev,
                        to_address: { ...prev.to_address, street: e.target.value }
                      }))}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="City"
                        value={createShipmentData.to_address.city}
                        onChange={(e) => setCreateShipmentData(prev => ({
                          ...prev,
                          to_address: { ...prev.to_address, city: e.target.value }
                        }))}
                      />
                      <Input
                        placeholder="State"
                        value={createShipmentData.to_address.state}
                        onChange={(e) => setCreateShipmentData(prev => ({
                          ...prev,
                          to_address: { ...prev.to_address, state: e.target.value }
                        }))}
                      />
                    </div>
                    <Input
                      placeholder="ZIP"
                      value={createShipmentData.to_address.zip}
                      onChange={(e) => setCreateShipmentData(prev => ({
                        ...prev,
                        to_address: { ...prev.to_address, zip: e.target.value }
                      }))}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setCreateShipmentOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateShipment}
                  disabled={createShipmentMutation.isPending}
                >
                  {createShipmentMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Create Shipment
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shipments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order Line</TableHead>
                  <TableHead>Tracking Code</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : (
                  shipments?.map((shipment) => (
                    <TableRow key={shipment.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{shipment.order_lines.patient_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatAddress(shipment.order_lines.patient_address)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-sm">{shipment.tracking_code}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{shipment.carrier}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(shipment.status)}</TableCell>
                      <TableCell>${shipment.rate.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRefreshTracking(shipment.tracking_code)}
                            disabled={getTrackingMutation.isPending}
                          >
                            {getTrackingMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                          </Button>
                          {shipment.tracking_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(shipment.tracking_url, '_blank')}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          )}
                          {shipment.label_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(shipment.label_url, '_blank')}
                            >
                              <Package className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
                {shipments?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No shipments found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
