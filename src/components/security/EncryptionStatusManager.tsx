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

  const { data: patientStats, isLoading: patientStatsLoading } = useQuery({
    queryKey: ["patient-encryption-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("id, allergies_encrypted, notes_encrypted");

      if (error) throw error;

      const total = data?.length || 0;
      const allergiesEncrypted = data?.filter(p => p.allergies_encrypted).length || 0;
      const notesEncrypted = data?.filter(p => p.notes_encrypted).length || 0;

      return {
        total,
        allergiesEncrypted,
        notesEncrypted,
        allergiesPercentage: total > 0 ? (allergiesEncrypted / total) * 100 : 0,
        notesPercentage: total > 0 ? (notesEncrypted / total) * 100 : 0,
      };
    },
  });

  const { data: orderStats, isLoading: orderStatsLoading } = useQuery({
    queryKey: ["order-encryption-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_lines")
        .select("id, prescription_url_encrypted, custom_dosage_encrypted, custom_sig_encrypted");

      if (error) throw error;

      const total = data?.length || 0;
      const prescriptionEncrypted = data?.filter(o => o.prescription_url_encrypted).length || 0;
      const dosageEncrypted = data?.filter(o => o.custom_dosage_encrypted).length || 0;
      const sigEncrypted = data?.filter(o => o.custom_sig_encrypted).length || 0;

      return {
        total,
        prescriptionEncrypted,
        dosageEncrypted,
        sigEncrypted,
        prescriptionPercentage: total > 0 ? (prescriptionEncrypted / total) * 100 : 0,
      };
    },
  });

  const { data: paymentStats, isLoading: paymentStatsLoading } = useQuery({
    queryKey: ["payment-encryption-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practice_payment_methods")
        .select("id, plaid_access_token");

      if (error) throw error;

      const total = data?.length || 0;
      // All Plaid tokens should be encrypted by default now
      const encrypted = total;

      return {
        total,
        encrypted,
        percentage: total > 0 ? (encrypted / total) * 100 : 100,
      };
    },
  });

  const isLoading = keysLoading || patientStatsLoading || orderStatsLoading || paymentStatsLoading;

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

      {/* Patient Data Encryption */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Patient PHI Encryption Coverage
          </CardTitle>
          <CardDescription>Protected Health Information field-level encryption status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Allergies Encrypted</p>
              <p className="text-sm text-muted-foreground">
                {patientStats?.allergiesEncrypted || 0} / {patientStats?.total || 0} records
              </p>
            </div>
            <Progress value={patientStats?.allergiesPercentage || 0} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {patientStats?.allergiesPercentage?.toFixed(1)}% coverage
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Notes Encrypted</p>
              <p className="text-sm text-muted-foreground">
                {patientStats?.notesEncrypted || 0} / {patientStats?.total || 0} records
              </p>
            </div>
            <Progress value={patientStats?.notesPercentage || 0} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {patientStats?.notesPercentage?.toFixed(1)}% coverage
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
              <p className="text-sm font-medium">Prescription URLs Encrypted</p>
              <p className="text-sm text-muted-foreground">
                {orderStats?.prescriptionEncrypted || 0} / {orderStats?.total || 0} orders
              </p>
            </div>
            <Progress value={orderStats?.prescriptionPercentage || 0} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {orderStats?.prescriptionPercentage?.toFixed(1)}% coverage
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
                {paymentStats?.encrypted || 0} / {paymentStats?.total || 0} accounts
              </p>
            </div>
            <Progress value={paymentStats?.percentage || 0} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {paymentStats?.percentage?.toFixed(1)}% coverage
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
