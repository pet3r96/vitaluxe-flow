import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, User, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface OrderStatusHistoryProps {
  orderId: string;
}

export const OrderStatusHistory = ({ orderId }: OrderStatusHistoryProps) => {
  const { data: statusHistory, isLoading } = useQuery({
    queryKey: ["order-status-history", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_status_history")
        .select(`
          *,
          changed_by_user:profiles!order_status_history_changed_by_fkey(name, email)
        `)
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: statusConfigs } = useQuery({
    queryKey: ["order-status-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_status_configs")
        .select("*");

      if (error) throw error;
      return data;
    },
  });

  const getStatusConfig = (statusKey: string) => {
    return statusConfigs?.find((s) => s.status_key === statusKey);
  };

  if (isLoading) {
    return <div>Loading history...</div>;
  }

  if (!statusHistory || statusHistory.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Status History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No status changes recorded yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Status History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-4">
            {statusHistory.map((entry, index) => {
              const oldConfig = getStatusConfig(entry.old_status);
              const newConfig = getStatusConfig(entry.new_status);

              return (
                <div key={entry.id}>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {oldConfig && (
                          <Badge className={oldConfig.color_class} variant="outline">
                            {oldConfig.display_name}
                          </Badge>
                        )}
                        <span className="text-muted-foreground">→</span>
                        {newConfig && (
                          <Badge className={newConfig.color_class}>
                            {newConfig.display_name}
                          </Badge>
                        )}
                      </div>
                      {entry.is_manual_override && (
                        <Badge variant="secondary" className="text-xs">
                          Manual
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3" />
                        <span>
                          {entry.changed_by_user?.name || "System"} ({entry.changed_by_role})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        <span>
                          {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>

                    {entry.change_reason && (
                      <p className="text-sm italic text-muted-foreground bg-muted p-2 rounded">
                        "{entry.change_reason}"
                      </p>
                    )}
                  </div>
                  {index < statusHistory.length - 1 && <Separator className="my-4" />}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};