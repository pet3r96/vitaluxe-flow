import { ProvidersDataTable } from "@/components/providers/ProvidersDataTable";

const Providers = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Provider Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage all medical providers (doctors) in the system
        </p>
      </div>

      <ProvidersDataTable />
    </div>
  );
};

export default Providers;
