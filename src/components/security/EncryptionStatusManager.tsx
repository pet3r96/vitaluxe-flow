import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Key, Shield, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { format } from "date-fns";

export const EncryptionStatusManager = () => {
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

  const isLoading = keysLoading || coverageLoading;

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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Patient PHI Encryption Coverage
          </CardTitle>
          <CardDescription>Protected Health Information field-level encryption status</CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Patient Data Encrypted</p>
              <p className="text-sm text-muted-foreground">
                {patientPHI.encrypted} / {patientPHI.total} records
              </p>
            </div>
            <Progress value={patientPHI.percentage} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {patientPHI.percentage.toFixed(1)}% coverage
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Prescription Data Encryption */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Prescription Data Encryption
          </CardTitle>
          <CardDescription>DEA-regulated prescription information protection</CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Prescription Data Encrypted</p>
              <p className="text-sm text-muted-foreground">
                {prescriptionData.encrypted} / {prescriptionData.total} records
              </p>
            </div>
            <Progress value={prescriptionData.percentage} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {prescriptionData.percentage.toFixed(1)}% coverage
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Payment Method Encryption */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Banking Data Encryption
          </CardTitle>
          <CardDescription>Plaid access token and payment method protection</CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Payment Methods Secured</p>
              <p className="text-sm text-muted-foreground">
                {paymentMethods.encrypted} / {paymentMethods.total} accounts
              </p>
            </div>
            <Progress value={paymentMethods.percentage} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {paymentMethods.percentage.toFixed(1)}% coverage
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
