import { PatientsDataTable } from "@/components/patients/PatientsDataTable";
import { ResponsivePage } from "@/components/layout/ResponsivePage";
import { useEffect, useRef } from "react";
import { measurePageLoad } from "@/lib/performanceMonitor";

const Patients = () => {
  const perf = useRef(measurePageLoad('Patients')).current;

  useEffect(() => {
    return () => {
      perf.end();
    };
  }, [perf]);

  return (
    <ResponsivePage
      title="Patients"
      subtitle="Manage your patient information and records"
    >
      <PatientsDataTable />
    </ResponsivePage>
  );
};

export default Patients;
