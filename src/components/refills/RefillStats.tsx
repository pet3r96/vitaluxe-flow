import { Card } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Clock, Pill } from "lucide-react";
import { RefillableOrder } from "@/hooks/useRefillableOrders";

interface RefillStatsProps {
  orders: RefillableOrder[];
}

export function RefillStats({ orders }: RefillStatsProps) {
  const stats = {
    total: orders.length,
    eligible: orders.filter((o) => o.is_eligible).length,
    expiring: orders.filter((o) => o.is_expiring_soon).length,
    totalRefills: orders.reduce((sum, o) => sum + o.refills_remaining, 0),
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Pill className="h-8 w-8 text-primary" />
          <div>
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total Prescriptions</p>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
          <div>
            <p className="text-2xl font-bold">{stats.eligible}</p>
            <p className="text-sm text-muted-foreground">Eligible Now</p>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-8 w-8 text-amber-500" />
          <div>
            <p className="text-2xl font-bold">{stats.expiring}</p>
            <p className="text-sm text-muted-foreground">Expiring Soon</p>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Clock className="h-8 w-8 text-blue-500" />
          <div>
            <p className="text-2xl font-bold">{stats.totalRefills}</p>
            <p className="text-sm text-muted-foreground">Refills Available</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
