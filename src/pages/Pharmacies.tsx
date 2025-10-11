import { PharmaciesDataTable } from "@/components/pharmacies/PharmaciesDataTable";

const Pharmacies = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">Pharmacy Management</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          Manage pharmacy assignments, priorities, and states serviced
        </p>
      </div>

      <PharmaciesDataTable />
    </div>
  );
};

export default Pharmacies;
