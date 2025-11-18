import { lazy, Suspense } from "react";
import { ResponsivePage } from "@/components/layout/ResponsivePage";
import { TableSkeleton } from "@/components/ui/table-skeleton";

const SubscriptionManagement = lazy(() => import("@/components/admin/SubscriptionManagement").then(m => ({ default: m.SubscriptionManagement })));

const Subscriptions = () => {
  return (
    <ResponsivePage
      title="Subscriptions"
      subtitle="Manage practice subscriptions, custom pricing, and sales rep commissions"
    >
      <Suspense fallback={<TableSkeleton rows={10} columns={7} />}>
        <SubscriptionManagement />
      </Suspense>
    </ResponsivePage>
  );
};

export default Subscriptions;
