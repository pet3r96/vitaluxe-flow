import { RepresentativesDataTable } from "@/components/admin/RepresentativesDataTable";

const Representatives = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">
          Representatives Management
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          Manage topline and downline sales representatives
        </p>
      </div>

      <RepresentativesDataTable />
    </div>
  );
};

export default Representatives;
