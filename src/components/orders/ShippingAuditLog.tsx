import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History } from "lucide-react";
import { format } from "date-fns";

interface ShippingAuditLogProps {
  orderLineId: string;
}

export const ShippingAuditLog = ({ orderLineId }: ShippingAuditLogProps) => {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["shipping-audit-logs", orderLineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_audit_logs")
        .select(`
          *,
          updated_by_profile:updated_by(name)
        `)
        .eq("order_line_id", orderLineId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading history...</div>;
  if (!logs || logs.length === 0) return null;

  return (
    <div className="mt-4 p-3 bg-muted/30 rounded-md">
      <div className="flex items-center gap-2 mb-3">
        <History className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Change History</span>
      </div>
      
      <ScrollArea className="h-32">
        <div className="space-y-2">
          {logs.map((log: any) => (
            <div key={log.id} className="text-xs pb-2 border-b border-border last:border-0">
              <p className="text-muted-foreground">
                {format(new Date(log.created_at), "PPp")} - {log.updated_by_profile?.name}
              </p>
              <p>{log.change_description}</p>
              {log.new_tracking_number && (
                <p className="text-muted-foreground">Tracking: {log.new_tracking_number}</p>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
