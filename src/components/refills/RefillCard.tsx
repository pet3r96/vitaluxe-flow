import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, ExternalLink, Calendar, User, Phone } from "lucide-react";
import { RefillableOrder } from "@/hooks/useRefillableOrders";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { QuickRefillDialog } from "@/components/orders/QuickRefillDialog";
import { useNavigate } from "react-router-dom";

interface RefillCardProps {
  order: RefillableOrder;
  onRefillComplete?: () => void;
}

export function RefillCard({ order, onRefillComplete }: RefillCardProps) {
  const [showRefillDialog, setShowRefillDialog] = useState(false);
  const navigate = useNavigate();

  const getStatusBadge = () => {
    if (order.is_eligible) {
      return <Badge className="bg-green-500">Eligible</Badge>;
    } else if (order.months_old >= 6) {
      return <Badge variant="destructive">Expired</Badge>;
    } else if (order.refills_remaining === 0) {
      return <Badge variant="secondary">No Refills</Badge>;
    }
    return <Badge variant="outline">Not Eligible</Badge>;
  };

  const refillProgress = ((order.refills_total - order.refills_remaining) / order.refills_total) * 100;

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">{order.product_name}</h3>
              <p className="text-sm text-muted-foreground">
                Order #{order.order_number}
              </p>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{order.patient_name}</span>
            </div>
            {order.patient_phone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{order.patient_phone}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                Ordered {formatDistanceToNow(new Date(order.order_created_at), { addSuffix: true })}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Refills Status</span>
              <span className="font-medium">
                {order.refills_remaining} of {order.refills_total} remaining
              </span>
            </div>
            <Progress value={refillProgress} className="h-2" />
          </div>

          {order.is_expiring_soon && (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded">
              <Calendar className="h-4 w-4" />
              <span>Expires in {6 - order.months_old} month(s)</span>
            </div>
          )}

          {order.custom_dosage && (
            <div className="text-sm">
              <p className="text-muted-foreground">Dosage:</p>
              <p className="font-medium">{order.custom_dosage}</p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1"
              disabled={!order.is_eligible}
              onClick={() => setShowRefillDialog(true)}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Quick Refill
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(`/orders`)}
              title="View Original Order"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {showRefillDialog && (
        <QuickRefillDialog
          open={showRefillDialog}
          onOpenChange={setShowRefillDialog}
          orderLine={order}
          onSuccess={() => {
            setShowRefillDialog(false);
            onRefillComplete?.();
          }}
        />
      )}
    </>
  );
}
