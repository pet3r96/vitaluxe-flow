import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, CheckCircle } from "lucide-react";

export default function EmergencyAdminRecovery() {
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    emailFix?: { success: boolean; message: string };
    passwordReset?: { success: boolean; message: string; password?: string };
  }>({});

  const handleRecovery = async () => {
    if (!secret.trim()) {
      setResults({
        emailFix: { success: false, message: "Emergency secret is required" }
      });
      return;
    }

    setLoading(true);
    setResults({});

    try {
      // Step 1: Fix admin email
      console.log("Invoking fix-admin-email...");
      const { data: emailData, error: emailError } = await supabase.functions.invoke(
        "fix-admin-email",
        { method: "POST" }
      );

      const emailResult = emailError 
        ? { success: false, message: emailError.message }
        : { success: true, message: emailData?.message || "Email updated successfully" };

      setResults(prev => ({ ...prev, emailFix: emailResult }));

      // Step 2: Reset password with emergency function
      console.log("Invoking emergency-admin-reset...");
      const { data: resetData, error: resetError } = await supabase.functions.invoke(
        "emergency-admin-reset",
        {
          method: "POST",
          headers: {
            "x-emergency-secret": secret
          }
        }
      );

      const resetResult = resetError
        ? { success: false, message: resetError.message }
        : { 
            success: true, 
            message: resetData?.message || "Password reset successfully",
            password: resetData?.temporary_password
          };

      setResults(prev => ({ ...prev, passwordReset: resetResult }));

    } catch (error) {
      console.error("Recovery error:", error);
      setResults({
        emailFix: { success: false, message: "An unexpected error occurred" }
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
      <Card className="w-full max-w-lg shadow-elegant">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <AlertTriangle className="h-6 w-6 text-warning" />
            Emergency Admin Recovery
          </CardTitle>
          <CardDescription>
            This tool will reset the admin account to info@vitaluxeservices.com with a temporary password
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="secret" className="text-sm font-medium">
              Emergency Secret
            </label>
            <Input
              id="secret"
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Enter emergency secret"
              disabled={loading}
            />
          </div>

          <Button 
            onClick={handleRecovery} 
            disabled={loading || !secret.trim()}
            className="w-full"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Processing..." : "Execute Recovery"}
          </Button>

          {results.emailFix && (
            <Alert variant={results.emailFix.success ? "default" : "destructive"}>
              <div className="flex items-start gap-2">
                {results.emailFix.success ? (
                  <CheckCircle className="h-5 w-5 text-success mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 mt-0.5" />
                )}
                <div>
                  <p className="font-medium">Email Update</p>
                  <AlertDescription>{results.emailFix.message}</AlertDescription>
                </div>
              </div>
            </Alert>
          )}

          {results.passwordReset && (
            <Alert variant={results.passwordReset.success ? "default" : "destructive"}>
              <div className="flex items-start gap-2">
                {results.passwordReset.success ? (
                  <CheckCircle className="h-5 w-5 text-success mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 mt-0.5" />
                )}
                <div className="space-y-2 w-full">
                  <p className="font-medium">Password Reset</p>
                  <AlertDescription>{results.passwordReset.message}</AlertDescription>
                  {results.passwordReset.success && results.passwordReset.password && (
                    <div className="mt-4 p-4 bg-muted rounded-md space-y-2">
                      <p className="text-sm font-semibold text-success">✓ Recovery Complete!</p>
                      <div className="space-y-1 text-sm">
                        <p><strong>Email:</strong> info@vitaluxeservices.com</p>
                        <p><strong>Temporary Password:</strong> {results.passwordReset.password}</p>
                        <p className="text-muted-foreground mt-2">
                          You will be required to change this password on first login.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        className="w-full mt-4"
                        onClick={() => window.location.href = "/"}
                      >
                        Go to Login
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Alert>
          )}

          <Alert>
            <AlertDescription className="text-xs text-muted-foreground">
              ⚠️ This is an emergency recovery tool. After successful recovery, the emergency function should be removed for security.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
