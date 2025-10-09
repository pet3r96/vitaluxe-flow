import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const Accounts = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold gold-text-gradient">Accounts</h1>
          <p className="text-muted-foreground mt-2">
            Manage user accounts and roles
          </p>
        </div>
        <Button className="gold-gradient text-primary-foreground font-semibold">
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </div>

      <Card className="p-6 bg-card border-border shadow-gold">
        <p className="text-muted-foreground">
          No accounts found. Add your first account to get started.
        </p>
      </Card>
    </div>
  );
};

export default Accounts;
