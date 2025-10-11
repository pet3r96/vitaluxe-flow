import { AccountsDataTable } from "@/components/accounts/AccountsDataTable";

const Accounts = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">Account Management</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          Manage all user accounts across the system
        </p>
      </div>

      <AccountsDataTable />
    </div>
  );
};

export default Accounts;
