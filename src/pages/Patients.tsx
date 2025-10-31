import { PatientsDataTable } from "@/components/patients/PatientsDataTable";
import { useAuth } from "@/contexts/AuthContext";

const Patients = () => {
  const { effectiveRole } = useAuth();

  return (
    <div className="patient-container">
      <div className="mb-8">
        <h1 className="text-left text-3xl sm:text-4xl font-bold gold-text-gradient">Patients</h1>
        <p className="text-muted-foreground mt-2">
          Manage your patient information and records
        </p>
      </div>

      <div className="mt-6">
        <PatientsDataTable />
      </div>
    </div>
  );
};

export default Patients;
