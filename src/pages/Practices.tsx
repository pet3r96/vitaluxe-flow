import { PracticesDataTable } from "@/components/practices/PracticesDataTable";

const Practices = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Practice Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage all medical practices in the system
        </p>
      </div>

      <PracticesDataTable />
    </div>
  );
};

export default Practices;
