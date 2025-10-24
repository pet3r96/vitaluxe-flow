import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Package, Clock, RefreshCw, Truck, CheckCircle, Pause, XCircle } from "lucide-react";

interface OrderStatusTabsProps {
  activeStatus: string;
  onStatusChange: (status: string) => void;
  orders: any[];
  availableStatuses: any[];
}

export const OrderStatusTabs = ({
  activeStatus,
  onStatusChange,
  orders,
  availableStatuses,
}: OrderStatusTabsProps) => {
  const getStatusIcon = (status: string) => {
    const icons: Record<string, any> = {
      all: Package,
      pending: Clock,
      processing: RefreshCw,
      filled: RefreshCw,
      shipped: Truck,
      delivered: CheckCircle,
      completed: CheckCircle,
      on_hold: Pause,
      denied: XCircle,
      cancelled: XCircle,
      canceled: XCircle,
    };
    return icons[status] || Package;
  };

  const getCounts = () => {
    const counts: Record<string, number> = {
      all: orders.length,
    };

    availableStatuses?.forEach((config) => {
      counts[config.status_key] = orders.filter(
        (o) => o.status === config.status_key
      ).length;
    });

    return counts;
  };

  const counts = getCounts();

  return (
    <Tabs value={activeStatus} onValueChange={onStatusChange} className="w-full">
      <TabsList className="w-full justify-start flex-wrap h-auto gap-2 bg-muted/50 p-2">
        <TabsTrigger
          value="all"
          className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
        >
          <Package className="h-4 w-4" />
          <span>All</span>
          <Badge variant="secondary" className="ml-1">
            {counts.all}
          </Badge>
        </TabsTrigger>

        {availableStatuses?.map((config) => {
          const Icon = getStatusIcon(config.status_key);
          const count = counts[config.status_key] || 0;

          return (
            <TabsTrigger
              key={config.id}
              value={config.status_key}
              className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Icon className="h-4 w-4" />
              <span>{config.display_name}</span>
              <Badge variant="secondary" className="ml-1">
                {count}
              </Badge>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
};
