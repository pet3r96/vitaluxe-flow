import { StaffDataTable } from "@/components/staff/StaffDataTable";
import { useAuth } from "@/contexts/AuthContext";
import { ResponsivePage } from "@/components/layout/ResponsivePage";

const Staff = () => {
  const { effectiveRole, isProviderAccount, isStaffAccount } = useAuth();

  // Only practices (not provider/staff accounts) can access this page
  if (effectiveRole !== 'doctor' || isProviderAccount || isStaffAccount) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">You do not have access to this page.</p>
      </div>
    );
  }

  return (
    <ResponsivePage
      title="My Staff"
      subtitle="Manage staff members for your practice"
    >
      <StaffDataTable />
    </ResponsivePage>
  );
};

export default Staff;
