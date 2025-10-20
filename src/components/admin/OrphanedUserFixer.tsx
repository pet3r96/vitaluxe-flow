import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle, Loader2, Wrench, Users, Building2, UserCheck, UserCog, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FixResult {
  roleType: 'pharmacy' | 'practice' | 'topline' | 'downline' | 'provider';
  entityId: string;
  entityName: string;
  email: string;
  success: boolean;
  userId?: string;
  tempPassword?: string;
  error?: string;
}

interface RoleSummary {
  fixed: number;
  total: number;
}

interface FixResponse {
  message: string;
  summary: {
    pharmacies: RoleSummary;
    practices: RoleSummary;
    topline_reps: RoleSummary;
    downline_reps: RoleSummary;
    providers: RoleSummary;
  };
  results: FixResult[];
}

const roleConfig = {
  pharmacy: { label: "Pharmacies", icon: Building2, color: "bg-blue-500" },
  practice: { label: "Practices", icon: Building2, color: "bg-purple-500" },
  topline: { label: "Topline Reps", icon: UserCheck, color: "bg-green-500" },
  downline: { label: "Downline Reps", icon: UserCog, color: "bg-orange-500" },
  provider: { label: "Providers", icon: Stethoscope, color: "bg-pink-500" },
};

export const OrphanedUserFixer = () => {
  const [fixing, setFixing] = useState(false);
  const [results, setResults] = useState<FixResponse | null>(null);
  const [selectedRoleType, setSelectedRoleType] = useState<string>("all");
  const { toast } = useToast();

  const handleFixOrphans = async () => {
    setFixing(true);
    setResults(null);

    try {
      const payload = selectedRoleType !== "all" ? { roleType: selectedRoleType } : {};
      
      const { data, error } = await supabase.functions.invoke<FixResponse>('fix-orphaned-users', {
        body: payload,
      });

      if (error) throw error;

      setResults(data);

      const totalFixed = Object.values(data.summary).reduce((sum, s) => sum + s.fixed, 0);
      const totalOrphaned = Object.values(data.summary).reduce((sum, s) => sum + s.total, 0);

      if (totalFixed === 0) {
        toast({
          title: "No orphaned users",
          description: "All user accounts are properly configured.",
        });
      } else {
        toast({
          title: "Users fixed!",
          description: `Successfully fixed ${totalFixed} of ${totalOrphaned} orphaned users.`,
        });
      }
    } catch (error: any) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error('Error fixing orphaned users', error);
      });
      toast({
        title: "Error",
        description: error.message || "Failed to fix orphaned users",
        variant: "destructive",
      });
    } finally {
      setFixing(false);
    }
  };

  const groupedResults = results?.results.reduce((acc, result) => {
    if (!acc[result.roleType]) {
      acc[result.roleType] = [];
    }
    acc[result.roleType].push(result);
    return acc;
  }, {} as Record<string, FixResult[]>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Fix Orphaned Users
        </CardTitle>
        <CardDescription>
          Creates user accounts for all role types that are missing authentication credentials.
          This fixes entities missing from the impersonation dropdown.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Role Type</label>
          <Select value={selectedRoleType} onValueChange={setSelectedRoleType}>
            <SelectTrigger>
              <SelectValue placeholder="Select role type to fix" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  All User Types
                </div>
              </SelectItem>
              <SelectItem value="pharmacy">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Pharmacies Only
                </div>
              </SelectItem>
              <SelectItem value="practice">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Practices Only
                </div>
              </SelectItem>
              <SelectItem value="topline">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  Topline Reps Only
                </div>
              </SelectItem>
              <SelectItem value="downline">
                <div className="flex items-center gap-2">
                  <UserCog className="h-4 w-4" />
                  Downline Reps Only
                </div>
              </SelectItem>
              <SelectItem value="provider">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4" />
                  Providers Only
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button 
          onClick={handleFixOrphans} 
          disabled={fixing}
          className="w-full"
        >
          {fixing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Fixing Orphaned Users...
            </>
          ) : (
            <>
              <Wrench className="mr-2 h-4 w-4" />
              {selectedRoleType === "all" ? "Fix All Orphaned Users" : `Fix ${roleConfig[selectedRoleType as keyof typeof roleConfig]?.label || "Selected"}`}
            </>
          )}
        </Button>

        {results && (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {results.message}
              </AlertDescription>
            </Alert>

            {/* Summary Cards */}
            {Object.entries(results.summary).some(([_, summary]) => summary.total > 0) && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {Object.entries(results.summary).map(([key, summary]) => {
                  if (summary.total === 0) return null;
                  const roleKey = key.replace('_reps', '') as keyof typeof roleConfig;
                  const config = roleConfig[roleKey];
                  const Icon = config?.icon || Users;
                  
                  return (
                    <Card key={key} className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium">{config?.label || key}</span>
                      </div>
                      <div className="text-2xl font-bold">
                        {summary.fixed}/{summary.total}
                      </div>
                      <div className="text-xs text-muted-foreground">fixed</div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Grouped Results */}
            {groupedResults && Object.entries(groupedResults).length > 0 && (
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Detailed Results:</h4>
                {Object.entries(groupedResults).map(([roleType, roleResults]) => {
                  const config = roleConfig[roleType as keyof typeof roleConfig];
                  const Icon = config?.icon || Users;
                  
                  return (
                    <div key={roleType} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Icon className="h-3 w-3" />
                          {config?.label || roleType}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          ({roleResults.filter(r => r.success).length}/{roleResults.length} successful)
                        </span>
                      </div>
                      
                      {roleResults.map((result) => (
                        <Alert 
                          key={result.entityId}
                          variant={result.success ? "default" : "destructive"}
                        >
                          {result.success ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <AlertCircle className="h-4 w-4" />
                          )}
                          <AlertDescription>
                            <div className="space-y-1">
                              <div className="font-medium">{result.entityName}</div>
                              <div className="text-xs text-muted-foreground">{result.email}</div>
                              {result.success && result.tempPassword && (
                                <div className="text-xs bg-muted p-2 rounded mt-2">
                                  <strong>Temporary Password:</strong> {result.tempPassword}
                                  <div className="text-muted-foreground mt-1">
                                    Share this securely with the user
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
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
