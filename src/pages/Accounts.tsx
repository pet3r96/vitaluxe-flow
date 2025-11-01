import { AccountsDataTable } from "@/components/accounts/AccountsDataTable";
import { ResponsivePage } from "@/components/layout/ResponsivePage";

const Accounts = () => {
  return (
    <ResponsivePage
      title="Account Management"
      subtitle="Manage all user accounts across the system"
    >
      <AccountsDataTable />
    </ResponsivePage>
  );
};

export default Accounts;
