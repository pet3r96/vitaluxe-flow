import { RepresentativesDataTable } from "@/components/admin/RepresentativesDataTable";

const Representatives = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold gold-text-modern">
          Representatives Management
        </h1>
        <p className="text-sm sm:text-base text-muted mt-2">
          Manage topline and downline sales representatives
        </p>
      </div>

      <RepresentativesDataTable />
    </div>
  );
};

export default Representatives;
