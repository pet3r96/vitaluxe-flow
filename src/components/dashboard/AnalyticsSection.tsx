import { RevenueChart } from "./RevenueChart";
import { OrdersBreakdown } from "./OrdersBreakdown";
import { TopProducts } from "./TopProducts";
import { useAuth } from "@/contexts/AuthContext";

export function AnalyticsSection() {
  const { effectiveRole } = useAuth();
  
  // Hide Top Products for practice users (doctors, providers, staff)
  const isPracticeUser = effectiveRole === 'doctor' || effectiveRole === 'provider' || effectiveRole === 'staff';
  
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Analytics & Insights</h2>
      </div>
      <div className={`grid grid-cols-1 gap-4 lg:gap-6 ${isPracticeUser ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
        <RevenueChart />
        <OrdersBreakdown />
        {!isPracticeUser && <TopProducts />}
      </div>
    </section>
  );
}
