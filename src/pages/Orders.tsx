import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { OrdersDataTable } from "@/components/orders/OrdersDataTable";
import { ResponsivePage } from "@/components/layout/ResponsivePage";
import { CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Orders page component
const Orders = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showBanner, setShowBanner] = useState(false);
  const [bannerData, setBannerData] = useState<{
    orderNumber: string;
    orderCount: number;
  } | null>(null);

  useEffect(() => {
    // Check if we were redirected from checkout with success state
    if (location.state?.orderPlaced) {
      setShowBanner(true);
      setBannerData({
        orderNumber: location.state.orderNumber || 'N/A',
        orderCount: location.state.orderCount || 1
      });

      // Clear the state to prevent banner from showing on refresh
      navigate(location.pathname, { replace: true });

      // Auto-dismiss after 10 seconds
      const timer = setTimeout(() => {
        setShowBanner(false);
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [location, navigate]);

  return (
    <ResponsivePage
      title="Order Management"
      subtitle="View and manage all orders across the system"
    >
      {showBanner && bannerData && (
        <div className="mb-6 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-green-900 dark:text-green-100">
              Your order has been placed successfully! 🎉
            </h3>
            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
              {bannerData.orderCount > 1 
                ? `${bannerData.orderCount} orders placed successfully.` 
                : `Order #${bannerData.orderNumber} has been placed and paid.`}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowBanner(false)}
            className="text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      <OrdersDataTable />
    </ResponsivePage>
  );
};

export default Orders;
