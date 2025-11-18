import { PharmaciesDataTable } from "@/components/pharmacies/PharmaciesDataTable";
import { ResponsivePage } from "@/components/layout/ResponsivePage";

const Pharmacies = () => {
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
