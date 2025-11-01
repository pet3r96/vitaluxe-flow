import { RepresentativesDataTable } from "@/components/admin/RepresentativesDataTable";

const Representatives = () => {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-4xl sm:text-5xl font-heading font-bold gold-text-modern tracking-tight">
          Representatives
        </h1>
        <p className="text-base text-muted-foreground">
          Manage your topline and downline sales representatives
        </p>
      </div>

      <RepresentativesDataTable />
    </div>
  );
};

export default Representatives;
