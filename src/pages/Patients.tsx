import { PatientsDataTable } from "@/components/patients/PatientsDataTable";

const Patients = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Patients</h1>
        <p className="text-muted-foreground">
          Manage your patient information and records
        </p>
      </div>
      <PatientsDataTable />
    </div>
  );
};

export default Patients;
