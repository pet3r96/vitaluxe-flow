import { Card } from "@/components/ui/card";

const Reports = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold gold-text-gradient">Reports</h1>
        <p className="text-muted-foreground mt-2">
          View analytics and export data
        </p>
      </div>

      <Card className="p-6 bg-card border-border shadow-gold">
        <p className="text-muted-foreground">
          No reports available yet.
        </p>
      </Card>
    </div>
  );
};

export default Reports;
