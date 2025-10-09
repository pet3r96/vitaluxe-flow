import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const Pharmacies = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold gold-text-gradient">Pharmacies</h1>
          <p className="text-muted-foreground mt-2">
            Manage pharmacy assignments and priorities
          </p>
        </div>
        <Button className="gold-gradient text-primary-foreground font-semibold">
          <Plus className="mr-2 h-4 w-4" />
          Add Pharmacy
        </Button>
      </div>

      <Card className="p-6 bg-card border-border shadow-gold">
        <p className="text-muted-foreground">
          No pharmacies found. Add your first pharmacy to get started.
        </p>
      </Card>
    </div>
  );
};

export default Pharmacies;
