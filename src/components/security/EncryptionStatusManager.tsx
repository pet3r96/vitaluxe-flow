import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Key, Shield, AlertTriangle, CheckCircle2, Loader2, Info, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export const EncryptionStatusManager = () => {
  // Check if admin IP is banned
  const { data: ipBanned, isLoading: ipCheckLoading } = useQuery({
    queryKey: ['admin-ip-banned'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_admin_ip_banned' as any);
      if (error) throw error;
      return data as boolean;
    }
  });

  const { data: encryptionKeys, isLoading: keysLoading } = useQuery({
    queryKey: ["encryption-keys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("encryption_keys")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Use the new database function for encryption coverage
  const { data: coverageData, isLoading: coverageLoading } = useQuery({
    queryKey: ["encryption-coverage"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_encryption_coverage" as any);
      
      if (error) throw error;
      
      // Transform array to object for easy access
      const coverage: Record<string, { total: number; encrypted: number; percentage: number }> = {};
      
      if (Array.isArray(data)) {
        data.forEach((row: any) => {
          coverage[row.data_type] = {
            total: row.total_records,
            encrypted: row.encrypted_records,
            percentage: row.coverage_percentage || 0
          };
        });
      }
      
      return coverage;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const isLoading = keysLoading || coverageLoading || ipCheckLoading;

  // Show access restricted message if IP is banned
  if (ipBanned === true) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Access Restricted</AlertTitle>
        <AlertDescription>
          Your IP address has been banned from accessing encryption keys.
          Please contact a system administrator for assistance.
        </AlertDescription>
      </Alert>
    );
  }

  const getKeyStatus = (key: any) => {
    if (!key) return { status: "unknown", message: "No key found", variant: "secondary" as const };

    const daysSinceRotation = key.rotated_at
      ? Math.floor((Date.now() - new Date(key.rotated_at).getTime()) / (1000 * 60 * 60 * 24))
      : Math.floor((Date.now() - new Date(key.created_at).getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceRotation > 90) {
      return { status: "warning", message: `Key is ${daysSinceRotation} days old`, variant: "destructive" as const };
    } else if (daysSinceRotation > 60) {
      return { status: "caution", message: `Key is ${daysSinceRotation} days old`, variant: "secondary" as const };
    } else {
      return { status: "good", message: `Key rotated ${daysSinceRotation} days ago`, variant: "default" as const };
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const primaryKey = encryptionKeys?.[0];
  const keyStatus = getKeyStatus(primaryKey);
  
  // Extract coverage stats
  const patientPHI = coverageData?.["Patient PHI"] || { total: 0, encrypted: 0, percentage: 0 };
  const prescriptionData = coverageData?.["Prescription Data"] || { total: 0, encrypted: 0, percentage: 0 };
  const paymentMethods = coverageData?.["Payment Methods"] || { total: 0, encrypted: 0, percentage: 0 };

  // Helper to get progress bar color based on coverage
  const getProgressColor = (percentage: number, total: number) => {
    if (total === 0) return "bg-muted"; // No data
    if (percentage === 0) return "bg-destructive"; // Not encrypted
    if (percentage < 100) return "bg-yellow-500"; // Partially encrypted
    return "bg-green-500"; // Fully encrypted
  };

  // Helper to render coverage display
  const renderCoverageCard = (
    title: string,
    description: string,
    icon: React.ReactNode,
    stats: { total: number; encrypted: number; percentage: number }
  ) => {
    const hasData = stats.total > 0;
    const isEncrypted = stats.encrypted > 0;
    const isFullyEncrypted = stats.percentage === 100 && hasData;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">
                {hasData ? "Data Encrypted" : "No Data Available"}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  {hasData ? `${stats.encrypted} / ${stats.total} records` : "N/A"}
                </p>
                {hasData && (
                  isFullyEncrypted ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  )
                )}
                {!hasData && <Info className="h-4 w-4 text-muted-foreground" />}
              </div>
            </div>
            <Progress 
              value={hasData ? stats.percentage : 0} 
              className={cn("h-2", !hasData && "opacity-50")}
              indicatorClassName={getProgressColor(stats.percentage, stats.total)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {hasData ? `${stats.percentage.toFixed(1)}% coverage` : "No data to encrypt"}
            </p>
          </div>
          
          {hasData && !isEncrypted && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Encryption not enabled - Data stored in plain text
              </AlertDescription>
            </Alert>
          )}
          
          {!hasData && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                No {title.toLowerCase()} data exists to encrypt
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Encryption Key Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Encryption Key Status
          </CardTitle>
          <CardDescription>Monitor encryption key health and rotation schedule</CardDescription>
        </CardHeader>
        <CardContent>
          {primaryKey ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Active Key: {primaryKey.key_name}</p>
                  <p className="text-sm text-muted-foreground">
                    Created: {format(new Date(primaryKey.created_at), "MMM dd, yyyy")}
                    {primaryKey.rotated_at && ` • Last rotated: ${format(new Date(primaryKey.rotated_at), "MMM dd, yyyy")}`}
                  </p>
                </div>
                <Badge variant={keyStatus.variant}>
                  {keyStatus.status === "good" ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                  {keyStatus.message}
                </Badge>
              </div>
              {keyStatus.status === "warning" && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <p className="text-sm text-destructive">Encryption key should be rotated every 90 days for optimal security.</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No active encryption keys found.</p>
          )}
        </CardContent>
      </Card>

      {/* Patient PHI Encryption */}
      {renderCoverageCard(
        "Patient PHI Encryption Coverage",
        "Protected Health Information field-level encryption status",
        <Shield className="h-5 w-5" />,
        patientPHI
      )}

      {/* Prescription Data Encryption */}
      {renderCoverageCard(
        "Prescription Data Encryption",
        "DEA-regulated prescription information protection",
        <Shield className="h-5 w-5" />,
        prescriptionData
      )}

      {/* Payment Method Encryption */}
      {renderCoverageCard(
        "Banking Data Encryption",
        "Plaid access token and payment method protection",
        <Shield className="h-5 w-5" />,
        paymentMethods
      )}
    </div>
  );
};
