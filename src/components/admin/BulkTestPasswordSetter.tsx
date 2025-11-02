import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

const TEST_ACCOUNTS = [
  { email: "dsporn00@yahoo.com", role: "Practice - test practice 1" },
  { email: "testjohnpractice@gmail.com", role: "Provider - testjohnpractice.com" },
  { email: "testpharmacy1nj@gmail.com", role: "Pharmacy - testpharamcy 1nj" },
  { email: "testtopline1@gmail.com", role: "Topline rep - test topeline 1" },
  { email: "testsubrep1@gmail.com", role: "Downline - Testsubrep f downline" },
  { email: "johnsmith@test.com", role: "Patient - John smith" },
  { email: "johndoe@staff.com", role: "Staff - John Doe staffer" }
];

const TEST_PASSWORD = "TestPass2025!";

export const BulkTestPasswordSetter = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const { toast } = useToast();

  const handleSetAllPasswords = async () => {
    setIsProcessing(true);
    setResults({});
    const newResults: Record<string, { success: boolean; message: string }> = {};

    for (const account of TEST_ACCOUNTS) {
      try {
        const { data, error } = await supabase.functions.invoke('set-test-password', {
          body: {
            email: account.email,
            password: TEST_PASSWORD
          }
        });

        if (error) throw error;

        newResults[account.email] = {
          success: true,
          message: "Password set successfully"
        };
      } catch (error: any) {
        console.error(`Error setting password for ${account.email}:`, error);
        newResults[account.email] = {
          success: false,
          message: error.message || "Failed to set password"
        };
      }

      setResults({ ...newResults });
    }

    setIsProcessing(false);

    const successCount = Object.values(newResults).filter(r => r.success).length;
    toast({
      title: "Bulk Password Update Complete",
      description: `Successfully updated ${successCount} of ${TEST_ACCOUNTS.length} accounts`,
      variant: successCount === TEST_ACCOUNTS.length ? "default" : "destructive"
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Bulk Test Password Setter</CardTitle>
        <CardDescription>
          Set password "{TEST_PASSWORD}" for all 7 test accounts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleSetAllPasswords} 
          disabled={isProcessing}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Setting Passwords...
            </>
          ) : (
            "Set All Test Passwords"
          )}
        </Button>

        {Object.keys(results).length > 0 && (
          <div className="space-y-2 mt-4">
            <h4 className="font-semibold text-sm">Results:</h4>
            {TEST_ACCOUNTS.map(account => (
              <div 
                key={account.email} 
                className="flex items-start justify-between p-2 bg-muted rounded text-sm"
              >
                <div className="flex-1">
                  <p className="font-medium">{account.role}</p>
                  <p className="text-xs text-muted-foreground">{account.email}</p>
                  {results[account.email] && (
                    <p className="text-xs mt-1">{results[account.email].message}</p>
                  )}
                </div>
                <div className="ml-2">
                  {!results[account.email] ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : results[account.email].success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {Object.keys(results).length > 0 && Object.values(results).every(r => r.success) && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/20 rounded border border-green-200 dark:border-green-900">
            <p className="font-semibold text-green-800 dark:text-green-200">All passwords set successfully!</p>
            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
              Password: <code className="bg-green-100 dark:bg-green-900/50 px-2 py-1 rounded">{TEST_PASSWORD}</code>
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-2">
              Users will be required to change their password on first login.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
