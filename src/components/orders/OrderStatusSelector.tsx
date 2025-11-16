import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, AlertTriangle } from "lucide-react";

interface OrderStatusSelectorProps {
  order: any;
  onSuccess: () => void;
}

export const OrderStatusSelector = ({ order, onSuccess }: OrderStatusSelectorProps) => {
  const { effectiveRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [changeReason, setChangeReason] = useState("");

  const { data: statusConfigs } = useQuery({
    queryKey: ["order-status-configs"],
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

  const updateStatusMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("update-order-status", {
        body: {
          orderId: order.id,
          newStatus: selectedStatus,
          changeReason: changeReason || null,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast({ title: "Order status updated successfully" });
      setDialogOpen(false);
      setChangeReason("");
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error updating status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetOverrideMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("orders")
        .update({
          status_manual_override: false,
          status_override_reason: null,
        })
        .eq("id", order.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast({ title: "Auto-calculation restored" });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error resetting override",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const canChangeStatus = ["admin", "pharmacy", "doctor", "provider"].includes(effectiveRole || "");

  if (!canChangeStatus) {
    return null;
  }

  const currentStatusConfig = statusConfigs?.find((s) => s.status_key === order.status);
  const isManualOverride = order.status_manual_override;

  const handleStatusChange = (newStatus: string) => {
    setSelectedStatus(newStatus);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label>Status</Label>
        {isManualOverride && (
          <Badge variant="outline" className="text-xs">
            Manual Override
          </Badge>
        )}
      </div>

      <div className="flex gap-2">
        <Select value={order.status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {currentStatusConfig && (
                <Badge className={currentStatusConfig.color_class}>
                  {currentStatusConfig.display_name}
                </Badge>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {statusConfigs?.map((status) => (
              <SelectItem key={status.id} value={status.status_key}>
                <Badge className={status.color_class}>{status.display_name}</Badge>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isManualOverride && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => resetOverrideMutation.mutate()}
            title="Reset to auto-calculation"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isManualOverride && order.status_override_reason && (
        <p className="text-sm text-muted-foreground">
          Reason: {order.status_override_reason}
        </p>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Status Change</DialogTitle>
            <DialogDescription>
              Change order status to{" "}
              <Badge className={statusConfigs?.find((s) => s.status_key === selectedStatus)?.color_class}>
                {statusConfigs?.find((s) => s.status_key === selectedStatus)?.display_name}
              </Badge>
            </DialogDescription>
          </DialogHeader>

          {["cancelled", "denied", "on_hold"].includes(selectedStatus) && (
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md p-3 flex gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                This status change may require additional action or notification to relevant parties.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="changeReason">Reason for change (optional)</Label>
            <Textarea
              id="changeReason"
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              placeholder="Explain why the status is being changed manually..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => updateStatusMutation.mutate()}>
              Confirm Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};