import { RepresentativesDataTable } from "@/components/admin/RepresentativesDataTable";
import { ResponsivePage } from "@/components/layout/ResponsivePage";

const Representatives = () => {
  return (
    <ResponsivePage
      title="Representatives"
      subtitle="Manage your topline and downline sales representatives"
    >
      <RepresentativesDataTable />
    </ResponsivePage>
  );
};

export default Representatives;
