import { PatientsDataTable } from "@/components/patients/PatientsDataTable";

const Patients = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">Patients</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage your patient information and records
        </p>
      </div>
      <PatientsDataTable />
    </div>
  );
};

export default Patients;
