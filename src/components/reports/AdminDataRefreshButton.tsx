import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function AdminDataRefreshButton() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const { toast } = useToast();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setProgress("Starting refresh...");
    
    try {
      // Step 1: Recompute order profits
      setProgress("Recomputing order profits...");
      const { error: profitsError } = await supabase.functions.invoke('admin-recompute-profits');
      
      if (profitsError) throw new Error(`Profits: ${profitsError.message}`);

      // Step 2: Refresh rep productivity
      setProgress("Refreshing rep productivity...");
      const { error: repError } = await supabase.rpc('refresh_rep_productivity_summary');
      
      if (repError) throw new Error(`Rep productivity: ${repError.message}`);

      // Step 3: Backfill subscription commissions
      setProgress("Backfilling subscription commissions...");
      const { error: commissionsError } = await supabase.functions.invoke('backfill-subscription-commissions');
      
      if (commissionsError) throw new Error(`Commissions: ${commissionsError.message}`);

      setProgress("Complete!");
      toast({
        title: "Success",
        description: "All report data refreshed successfully. Page will reload.",
      });
      
      // Refresh the page to show updated data
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to refresh data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
      setProgress("");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={handleRefresh}
        disabled={isRefreshing}
        variant="outline"
        size="sm"
      >
        {isRefreshing ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4 mr-2" />
        )}
        {isRefreshing ? 'Refreshing...' : 'Refresh All Report Data'}
      </Button>
      {progress && (
        <p className="text-sm text-muted-foreground">{progress}</p>
      )}
    </div>
  );
}
