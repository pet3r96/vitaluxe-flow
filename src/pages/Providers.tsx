import { ProvidersDataTable } from "@/components/providers/ProvidersDataTable";
import { useAuth } from "@/contexts/AuthContext";
import { usePracticeRxPrivileges } from "@/hooks/usePracticeRxPrivileges";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Info } from "lucide-react";

const Providers = () => {
  const { effectiveRole, isProviderAccount, isStaffAccount } = useAuth();
  const { canOrderRx, hasProviders, providerCount, providersWithNpiCount } = usePracticeRxPrivileges();

  // Only practices and staff (not provider accounts) can access this page
  if ((effectiveRole !== 'doctor' && effectiveRole !== 'staff') || isProviderAccount) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">You do not have access to this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">My Providers</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          Manage medical providers for your practice
        </p>
      </div>

      {/* Alert: No providers at all */}
      {providerCount === 0 && (
        <Alert className="bg-destructive/10 border-destructive">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertDescription>
            <strong>No providers found.</strong> Your practice needs at least one provider with a valid NPI to order prescription products. Add a provider below to get started.
          </AlertDescription>
        </Alert>
      )}

      {/* Alert: Providers exist but none have NPI */}
      {providerCount > 0 && providersWithNpiCount === 0 && (
        <Alert className="bg-warning/10 border-warning">
          <Info className="h-4 w-4 text-warning" />
          <AlertDescription>
            <strong>NPI required for RX ordering.</strong> You have {providerCount} provider(s), but none have a valid NPI. Update at least one provider's NPI to enable prescription product ordering.
          </AlertDescription>
        </Alert>
      )}

      {/* Success state: Has providers with NPI */}
      {providersWithNpiCount > 0 && (
        <Alert className="bg-success/10 border-success">
          <Info className="h-4 w-4 text-success" />
          <AlertDescription>
            <strong>RX ordering enabled.</strong> Your practice has {providersWithNpiCount} provider(s) with valid NPIs. You can order prescription products.
          </AlertDescription>
        </Alert>
      )}

      <ProvidersDataTable />
    </div>
  );
};

export default Providers;
