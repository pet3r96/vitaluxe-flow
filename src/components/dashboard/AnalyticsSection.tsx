import { RevenueChart } from "./RevenueChart";
import { OrdersBreakdown } from "./OrdersBreakdown";
import { TopProducts } from "./TopProducts";
import { useAuth } from "@/contexts/AuthContext";

export function AnalyticsSection() {
  const { effectiveRole } = useAuth();
  
  // Hide Top Products for practice users (doctors, providers, staff) and admin
  const isPracticeUser = effectiveRole === 'doctor' || effectiveRole === 'provider' || effectiveRole === 'staff';
  const isAdmin = effectiveRole === 'admin';
  
  // Hide Revenue and Top Products for pharmacy users
  const isPharmacy = effectiveRole === 'pharmacy';
  
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Analytics & Insights</h2>
      </div>
      {isPharmacy ? (
        // Pharmacy: Only show Orders Breakdown
        <OrdersBreakdown />
      ) : isAdmin ? (
        // Admin: Revenue and Orders side-by-side (50/50) - always horizontal on desktop
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
          <RevenueChart className="col-span-1" />
          <OrdersBreakdown />
        </div>
      ) : (
        // Others: Revenue, Orders, and conditionally Top Products
        <div className={`grid grid-cols-1 gap-4 lg:gap-6 ${isPracticeUser ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
          <RevenueChart />
          <OrdersBreakdown />
          {!isPracticeUser && <TopProducts />}
        </div>
      )}
    </section>
  );
}
