import { SubscriptionManagement } from "@/components/admin/SubscriptionManagement";

const Subscriptions = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Subscriptions</h1>
        <p className="text-muted-foreground mt-2">
          Manage practice subscriptions, custom pricing, and sales rep commissions
        </p>
      </div>
      <SubscriptionManagement />
    </div>
  );
};

export default Subscriptions;
