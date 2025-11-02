import { AccountsDataTable } from "@/components/accounts/AccountsDataTable";
import { ResponsivePage } from "@/components/layout/ResponsivePage";
import { BulkTestPasswordSetter } from "@/components/admin/BulkTestPasswordSetter";

const Accounts = () => {
  return (
    <ResponsivePage
      title="Account Management"
      subtitle="Manage all user accounts across the system"
    >
      <div className="space-y-6">
        <BulkTestPasswordSetter />
        <AccountsDataTable />
      </div>
    </ResponsivePage>
  );
};

export default Accounts;
