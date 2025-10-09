import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";

interface DataSyncButtonProps {
  onSyncComplete: () => void;
}

export const DataSyncButton = ({ onSyncComplete }: DataSyncButtonProps) => {
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [syncResults, setSyncResults] = useState<any>(null);
  const { user } = useAuth();

  const handleSync = async () => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("sync-user-data", {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.success) {
        const summary = data.summary;
        setSyncResults(summary);
        setShowResults(true);

        if (summary.totalRepaired === 0) {
          toast.success("All records are already synchronized. No changes needed.");
        } else {
          toast.success(`Data sync completed! Repaired ${summary.totalRepaired} records.`);
        }

        // Trigger refetch of accounts
        onSyncComplete();
      }
    } catch (error: any) {
      console.error("Sync error:", error);
      toast.error(error.message || "Failed to sync data");
    } finally {
      setLoading(false);
    }
  };

  // Only show for authorized admin
  if (user?.email !== 'admin@vitaluxeservice.com') {
    return null;
  }

  return (
    <>
      <Button
        onClick={handleSync}
        disabled={loading}
        variant="outline"
        className="gap-2"
        title="Scan and repair user-role mapping issues"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        {loading ? "Syncing..." : "Run Data Sync"}
      </Button>

      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <DialogTitle>Data Sync Completed</DialogTitle>
            </div>
            <DialogDescription>
              Summary of changes made to user records
            </DialogDescription>
          </DialogHeader>

          {syncResults && (
            <div className="space-y-3 py-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between p-3 bg-muted rounded-md">
                  <span className="text-muted-foreground">Profiles added:</span>
                  <span className="font-semibold">{syncResults.addedProfiles}</span>
                </div>
                <div className="flex justify-between p-3 bg-muted rounded-md">
                  <span className="text-muted-foreground">User Roles added:</span>
                  <span className="font-semibold">{syncResults.addedRoles}</span>
                </div>
                <div className="flex justify-between p-3 bg-muted rounded-md">
                  <span className="text-muted-foreground">Pharmacies fixed:</span>
                  <span className="font-semibold">{syncResults.repairedPharmacies}</span>
                </div>
                {syncResults.orphanedPharmaciesConverted > 0 && (
                  <div className="flex justify-between p-3 bg-primary/10 rounded-md border border-primary/20">
                    <span className="text-muted-foreground font-semibold">Orphaned → Converted:</span>
                    <span className="font-bold text-primary">{syncResults.orphanedPharmaciesConverted}</span>
                  </div>
                )}
                <div className="flex justify-between p-3 bg-muted rounded-md">
                  <span className="text-muted-foreground">Providers fixed:</span>
                  <span className="font-semibold">{syncResults.repairedProviders}</span>
                </div>
                <div className="flex justify-between p-3 bg-muted rounded-md">
                  <span className="text-muted-foreground">Downlines fixed:</span>
                  <span className="font-semibold">{syncResults.repairedDownlines}</span>
                </div>
                <div className="flex justify-between p-3 bg-muted rounded-md">
                  <span className="text-muted-foreground">Toplines fixed:</span>
                  <span className="font-semibold">{syncResults.repairedToplines}</span>
                </div>
              </div>

              <div className="p-4 bg-primary/10 rounded-md border-l-4 border-primary">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-base">Total records repaired:</span>
                  <span className="text-2xl font-bold text-primary">{syncResults.totalRepaired}</span>
                </div>
              </div>

              {syncResults.errors && syncResults.errors.length > 0 && (
                <div className="p-3 bg-destructive/10 rounded-md border border-destructive/20">
                  <p className="text-sm font-semibold text-destructive mb-2">Errors encountered:</p>
                  <ul className="text-xs space-y-1 text-destructive/80">
                    {syncResults.errors.map((error: string, idx: number) => (
                      <li key={idx}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <Button onClick={() => setShowResults(false)} className="w-full">
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};
