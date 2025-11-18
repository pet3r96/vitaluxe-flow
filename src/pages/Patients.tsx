import { PatientsDataTable } from "@/components/patients/PatientsDataTable";
import { ResponsivePage } from "@/components/layout/ResponsivePage";

const Patients = () => {
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
