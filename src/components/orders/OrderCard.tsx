import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Download, Calendar, User, Building2, Package, Truck, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReceiptDownloadButton } from "./ReceiptDownloadButton";

interface OrderCardProps {
  order: any;
  effectiveRole: string;
  onViewDetails: () => void;
  onDownloadPrescription?: (prescriptionUrl: string, productName: string) => void;
  getStatusColor: (status: string) => string;
  getPaymentStatusColor: (status: string) => string;
  getPaymentStatusLabel: (status: string) => string;
}

export const OrderCard = ({
  order,
  effectiveRole,
  onViewDetails,
  onDownloadPrescription,
  getStatusColor,
  getPaymentStatusColor,
  getPaymentStatusLabel,
}: OrderCardProps) => {
  const firstOrderLine = order.order_lines?.[0];
  const patientName = firstOrderLine?.patient_name || "N/A";
  const isOnHold = order.status === "on_hold";
  const isRefunded = order.payment_status === "refunded" || order.payment_status === "partially_refunded";

  const formatProducts = (orderLines: any[], maxItems = 2): string[] => {
    if (!orderLines?.length) return ["No products"];
    
    const visible = orderLines.slice(0, maxItems);
    const remaining = orderLines.length - maxItems;
    
    const productNames = visible.map(line => 
      line.products?.name || "Product"
    );
    
    if (remaining > 0) {
      return [...productNames, `+${remaining} more`];
    }
    
    return productNames;
  };

  const formatShippingSpeed = (speed: string) => {
    if (speed === '2day') return '2-Day';
    if (speed === 'overnight') return 'Overnight';
    return 'Ground';
  };

  const formatShippingDestination = (shipTo: string) => {
    if (shipTo === 'practice') return '→ 🏢 Practice';
    if (shipTo === 'patient') return '→ 👤 Patient';
    return '→ Address';
  };

  const productsList = formatProducts(order.order_lines);

  return (
    <Card
      className={cn(
        "hover:shadow-lg transition-all duration-200",
        "focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2",
        isOnHold && "border-l-4 border-l-yellow-500 bg-yellow-50/30 dark:bg-yellow-950/20",
        isRefunded && "border-l-4 border-l-purple-500 bg-purple-50/30 dark:bg-purple-950/20"
      )}
    >
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left: Order Header */}
          <div className="space-y-3">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                #{order.id.slice(0, 8).toUpperCase()}
              </h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>{new Date(order.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <Badge className={cn("text-xs", getPaymentStatusColor(order.payment_status))}>
                  {getPaymentStatusLabel(order.payment_status)}
                </Badge>
              </div>
              
              {effectiveRole !== "pharmacy" && (
                <p className="text-xl font-bold text-foreground">
                  ${order.total_amount}
                </p>
              )}
            </div>
          </div>

          {/* Middle: Order Details */}
          <div className="space-y-3 md:col-span-1">
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">{patientName}</p>
                  <p className="text-xs text-muted-foreground">Patient</p>
                </div>
              </div>

              {order.profiles?.name && (
                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-foreground">{order.profiles.name}</p>
                    <p className="text-xs text-muted-foreground">Practice</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Package className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1 space-y-1">
                  {productsList.map((product, idx) => (
                    <p key={idx} className="text-sm text-foreground truncate">
                      {product}
                    </p>
                  ))}
                </div>
              </div>

              {firstOrderLine && (
                <div className="flex items-center gap-2 text-sm">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {formatShippingSpeed(firstOrderLine.shipping_speed)} {formatShippingDestination(order.ship_to)}
                  </span>
                </div>
              )}

              <Badge variant={order.ship_to === 'practice' ? 'secondary' : 'outline'} className="text-xs">
                {order.ship_to === 'practice' ? '🏢 Practice Delivery' : '👤 Patient Delivery'}
              </Badge>
            </div>
          </div>

          {/* Right: Actions & Status */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onViewDetails}
                className="flex-1"
              >
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </Button>

              {effectiveRole !== "pharmacy" && (
                <ReceiptDownloadButton
                  orderId={order.id}
                  orderDate={order.created_at}
                  practiceName={order.profiles?.name || "Practice"}
                />
              )}
            </div>

            {/* Prescription Downloads */}
            {effectiveRole !== "pharmacy" && order.order_lines?.some((line: any) => line.prescription_url) && (
              <div className="space-y-2">
                {order.order_lines?.map((line: any, idx: number) => 
                  line.prescription_url && onDownloadPrescription ? (
                    <Button
                      key={idx}
                      variant="ghost"
                      size="sm"
                      onClick={() => onDownloadPrescription(line.prescription_url, line.products?.name || 'prescription')}
                      className="w-full justify-start"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Rx: {line.products?.name || 'Prescription'}
                    </Button>
                  ) : null
                )}
              </div>
            )}

            {/* Status Badges */}
            <div className="mt-auto space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Order Status:</span>
                <Badge className={cn("text-sm", getStatusColor(order.status))}>
                  {order.status}
                </Badge>
              </div>

              {order.status_manual_override && (
                <Badge variant="outline" className="text-xs">
                  Manual Override
                </Badge>
              )}

              {firstOrderLine?.shipping_carrier && (
                <div className="text-xs text-muted-foreground">
                  Carrier: <span className="capitalize">{firstOrderLine.shipping_carrier}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
