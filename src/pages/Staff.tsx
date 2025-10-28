import { StaffDataTable } from "@/components/staff/StaffDataTable";
import { useAuth } from "@/contexts/AuthContext";

const Staff = () => {
  const { effectiveRole, isProviderAccount } = useAuth();

  // Only practices (not provider/staff accounts) can access this page
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
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">My Staff</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          Manage staff members for your practice
        </p>
      </div>
      <StaffDataTable />
    </div>
  );
};

export default Staff;
