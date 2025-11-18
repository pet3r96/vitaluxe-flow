import { SubscriptionManagement } from "@/components/admin/SubscriptionManagement";
import { ResponsivePage } from "@/components/layout/ResponsivePage";

const Subscriptions = () => {
  return (
    <ResponsivePage
      title="Subscriptions"
      subtitle="Manage practice subscriptions, custom pricing, and sales rep commissions"
    >
      <SubscriptionManagement />
    </ResponsivePage>
  );
};

export default Subscriptions;
