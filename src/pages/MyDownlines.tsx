import { useState } from "react";
import { DownlinesDataTable } from "@/components/downlines/DownlinesDataTable";
import { AddRepRequestDialog } from "@/components/admin/AddRepRequestDialog";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";

export default function MyDownlines() {
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">My Downlines</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">
            Manage your network of downline representatives and their practices
          </p>
        </div>
        <Button onClick={() => setRequestDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Request New Representative
        </Button>
      </div>
      
      <DownlinesDataTable />
      <AddRepRequestDialog
        open={requestDialogOpen}
        onOpenChange={setRequestDialogOpen}
      />
    </div>
  );
}
