import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle, Loader2, Wrench } from "lucide-react";

interface FixResult {
  pharmacyId: string;
  pharmacyName: string;
  email: string;
  success: boolean;
  userId?: string;
  tempPassword?: string;
  error?: string;
}

interface FixResponse {
  message: string;
  fixed: number;
  total: number;
  results: FixResult[];
}

export const OrphanedPharmacyFixer = () => {
  const [fixing, setFixing] = useState(false);
  const [results, setResults] = useState<FixResponse | null>(null);
  const { toast } = useToast();

  const handleFixOrphans = async () => {
    setFixing(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke<FixResponse>('fix-orphaned-pharmacy');

      if (error) throw error;

      setResults(data);

      if (data.fixed === 0) {
        toast({
          title: "No orphaned pharmacies",
          description: "All pharmacies have proper user accounts.",
        });
      } else {
        toast({
          title: "Pharmacies fixed!",
          description: `Successfully fixed ${data.fixed} of ${data.total} orphaned pharmacies.`,
        });
      }
    } catch (error: any) {
      console.error('Error fixing orphaned pharmacies:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to fix orphaned pharmacies",
        variant: "destructive",
      });
    } finally {
      setFixing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Fix Orphaned Pharmacies
        </CardTitle>
        <CardDescription>
          Creates user accounts for pharmacies that don't have authentication credentials.
          This fixes pharmacies that are missing from the impersonation dropdown.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleFixOrphans} 
          disabled={fixing}
          className="w-full"
        >
          {fixing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Fixing Orphaned Pharmacies...
            </>
          ) : (
            <>
              <Wrench className="mr-2 h-4 w-4" />
              Fix Orphaned Pharmacies
            </>
          )}
        </Button>

        {results && (
          <div className="space-y-3">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {results.message}
              </AlertDescription>
            </Alert>

            {results.results.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Results:</h4>
                {results.results.map((result) => (
                  <Alert 
                    key={result.pharmacyId}
                    variant={result.success ? "default" : "destructive"}
                  >
                    {result.success ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <AlertDescription>
                      <div className="space-y-1">
                        <div className="font-medium">{result.pharmacyName}</div>
                        <div className="text-xs text-muted-foreground">{result.email}</div>
                        {result.success && result.tempPassword && (
                          <div className="text-xs bg-muted p-2 rounded mt-2">
                            <strong>Temporary Password:</strong> {result.tempPassword}
                            <div className="text-muted-foreground mt-1">
                              Share this securely with the pharmacy user
                            </div>
                          </div>
                        )}
                        {!result.success && result.error && (
                          <div className="text-xs text-destructive mt-1">
                            Error: {result.error}
                          </div>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
