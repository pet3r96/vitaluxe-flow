import { ProvidersDataTable } from "@/components/providers/ProvidersDataTable";
import { useAuth } from "@/contexts/AuthContext";

const Providers = () => {
  const { effectiveRole, isProviderAccount } = useAuth();

  // Only practices (not provider accounts) can access this page
  if (effectiveRole !== 'doctor' || isProviderAccount) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">You do not have access to this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Providers</h1>
        <p className="text-muted-foreground mt-2">
          Manage medical providers for your practice
        </p>
      </div>
      <ProvidersDataTable />
    </div>
  );
};

export default Providers;
