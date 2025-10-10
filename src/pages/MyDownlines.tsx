import { DownlinesDataTable } from "@/components/downlines/DownlinesDataTable";

export default function MyDownlines() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Downlines</h1>
        <p className="text-muted-foreground mt-2">
          Manage your network of downline representatives and their practices
        </p>
      </div>
      
      <DownlinesDataTable />
    </div>
  );
}
