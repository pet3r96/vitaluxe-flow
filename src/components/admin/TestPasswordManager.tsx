import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Key, Copy, CheckCircle2 } from "lucide-react";

export function TestPasswordManager() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Validation Error",
        description: "Email and password are required",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('set-test-password', {
        body: { email, password }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data);
      toast({
        title: "Success",
        description: `Test password set for ${data.email}`,
      });
      
      // Reset form
      setEmail("");
      setPassword("");
    } catch (error: any) {
      console.error('Error setting test password:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to set test password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCredentials = () => {
    if (result) {
      const credentials = `Email: ${result.email}\nPassword: ${result.password}`;
      navigator.clipboard.writeText(credentials);
      setCopied(true);
      toast({
        title: "Copied",
        description: "Credentials copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const generateRandomPassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    const length = 16;
    let pwd = "";
    for (let i = 0; i < length; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pwd);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Test Password Manager
        </CardTitle>
        <CardDescription>
          Set temporary passwords for testing. Users will be required to change the password on first login.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSetPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">User Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Temporary Password</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={generateRandomPassword}
                disabled={isLoading}
              >
                Generate Random
              </Button>
            </div>
            <Input
              id="password"
              type="text"
              placeholder="Temporary password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Suggested: TestPass123!@#$ (or use Generate Random)
            </p>
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting Password...
              </>
            ) : (
              "Set Test Password"
            )}
          </Button>
        </form>

        {result && (
          <Alert className="mt-6 bg-primary/5 border-primary/20">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <AlertDescription>
              <div className="space-y-3">
                <div>
                  <p className="font-semibold mb-2">Test credentials set successfully:</p>
                  <div className="bg-background/50 p-3 rounded-md font-mono text-sm space-y-1">
                    <div><span className="text-muted-foreground">Email:</span> {result.email}</div>
                    <div><span className="text-muted-foreground">Password:</span> {result.password}</div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyCredentials}
                  className="w-full"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Credentials
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  ⚠️ User will be required to change this password on first login
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
