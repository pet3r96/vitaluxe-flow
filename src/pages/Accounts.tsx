import { AccountsDataTable } from "@/components/accounts/AccountsDataTable";
import { ResponsivePage } from "@/components/layout/ResponsivePage";
import { useEffect, useRef } from "react";
import { measurePageLoad } from "@/lib/performanceMonitor";

const Accounts = () => {
  const perf = useRef(measurePageLoad('Accounts')).current;

  useEffect(() => {
    return () => {
      perf.end();
    };
  }, [perf]);

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
