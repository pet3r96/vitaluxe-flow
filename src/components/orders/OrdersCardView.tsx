import { OrderCard } from "./OrderCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Package } from "lucide-react";

interface OrdersCardViewProps {
  orders: any[];
  isLoading: boolean;
  effectiveRole: string;
  onViewDetails: (order: any) => void;
  onDownloadPrescription?: (prescriptionUrl: string, productName: string) => void;
  getStatusColor: (status: string) => string;
  getPaymentStatusColor: (status: string) => string;
  getPaymentStatusLabel: (status: string) => string;
}

export const OrdersCardView = ({
  orders,
  isLoading,
  effectiveRole,
  onViewDetails,
  onDownloadPrescription,
  getStatusColor,
  getPaymentStatusColor,
  getPaymentStatusLabel,
}: OrdersCardViewProps) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <Package className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold mb-2 text-foreground">No orders found</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Orders will appear here once they are created
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          effectiveRole={effectiveRole}
          onViewDetails={() => onViewDetails(order)}
          onDownloadPrescription={onDownloadPrescription}
          getStatusColor={getStatusColor}
          getPaymentStatusColor={getPaymentStatusColor}
          getPaymentStatusLabel={getPaymentStatusLabel}
        />
      ))}
    </div>
  );
};
