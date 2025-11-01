import { RevenueChart } from "./RevenueChart";
import { OrdersBreakdown } from "./OrdersBreakdown";
import { TopProducts } from "./TopProducts";

export function AnalyticsSection() {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Analytics & Insights</h2>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <RevenueChart />
        <OrdersBreakdown />
        <TopProducts />
      </div>
    </section>
  );
}
