import { PharmaciesDataTable } from "@/components/pharmacies/PharmaciesDataTable";
import { ResponsivePage } from "@/components/layout/ResponsivePage";
import { useEffect, useRef } from "react";
import { measurePageLoad } from "@/lib/performanceMonitor";

const Pharmacies = () => {
  const perf = useRef(measurePageLoad('Pharmacies')).current;

  useEffect(() => {
    return () => {
      perf.end();
    };
  }, [perf]);

  return (
    <ResponsivePage
      title="Pharmacy Management"
      subtitle="Manage pharmacy assignments, priorities, and states serviced"
    >
      <PharmaciesDataTable />
    </ResponsivePage>
  );
};

export default Pharmacies;
