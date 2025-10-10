import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const AddressVerificationPanel = () => {
  const [verifying, setVerifying] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);

  const { data: invalidAddresses, isLoading, refetch } = useQuery({
    queryKey: ["invalid-addresses"],
    queryFn: async () => {
      const [patients, pharmacies, providers] = await Promise.all([
        supabase
          .from("patients")
          .select("id, name, address_formatted, address_verification_status, updated_at")
          .in("address_verification_status", ["invalid", "unverified"]),
        supabase
          .from("pharmacies")
          .select("id, name, address_formatted, address_verification_status, updated_at")
          .in("address_verification_status", ["invalid", "unverified"]),
        supabase
          .from("profiles")
          .select("id, name, address_formatted, address_verification_status, updated_at")
          .in("address_verification_status", ["invalid", "unverified"])
          .not("address_formatted", "is", null),
      ]);

      return {
        patients: patients.data || [],
        pharmacies: pharmacies.data || [],
        providers: providers.data || [],
        total: (patients.data?.length || 0) + (pharmacies.data?.length || 0) + (providers.data?.length || 0),
      };
    },
  });

  const handleBulkVerify = async (entityType: "all" | "patients" | "pharmacies" | "providers") => {
    setVerifying(true);
    setSelectedEntity(entityType);
    
    try {
      const { data, error } = await supabase.functions.invoke("bulk-verify-addresses", {
        body: { entity_type: entityType },
      });

      if (error) throw error;

      toast.success(
        `✅ Verification complete!\n${data.summary.verified} verified, ${data.summary.invalid} invalid`
      );
      
      refetch();
    } catch (error: any) {
      toast.error(`Failed to verify addresses: ${error.message}`);
    } finally {
      setVerifying(false);
      setSelectedEntity(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1" />Verified</Badge>;
      case "invalid":
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Invalid</Badge>;
      case "manual":
        return <Badge variant="secondary">Manual</Badge>;
      default:
        return <Badge variant="outline">Unverified</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Invalid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {invalidAddresses?.total || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Patients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invalidAddresses?.patients.length || 0}</div>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 w-full"
              onClick={() => handleBulkVerify("patients")}
              disabled={verifying}
            >
              {verifying && selectedEntity === "patients" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Verify
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pharmacies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invalidAddresses?.pharmacies.length || 0}</div>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 w-full"
              onClick={() => handleBulkVerify("pharmacies")}
              disabled={verifying}
            >
              {verifying && selectedEntity === "pharmacies" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Verify
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Providers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invalidAddresses?.providers.length || 0}</div>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 w-full"
              onClick={() => handleBulkVerify("providers")}
              disabled={verifying}
            >
              {verifying && selectedEntity === "providers" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Verify
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Invalid/Unverified Addresses</CardTitle>
            <Button
              onClick={() => handleBulkVerify("all")}
              disabled={verifying}
            >
              {verifying && selectedEntity === "all" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Verify All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {invalidAddresses?.patients.map((patient) => (
                      <TableRow key={`patient-${patient.id}`}>
                        <TableCell>
                          <Badge variant="outline">Patient</Badge>
                        </TableCell>
                        <TableCell>{patient.name}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {patient.address_formatted || "-"}
                        </TableCell>
                        <TableCell>{getStatusBadge(patient.address_verification_status)}</TableCell>
                        <TableCell>{new Date(patient.updated_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                    {invalidAddresses?.pharmacies.map((pharmacy) => (
                      <TableRow key={`pharmacy-${pharmacy.id}`}>
                        <TableCell>
                          <Badge variant="outline">Pharmacy</Badge>
                        </TableCell>
                        <TableCell>{pharmacy.name}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {pharmacy.address_formatted || "-"}
                        </TableCell>
                        <TableCell>{getStatusBadge(pharmacy.address_verification_status)}</TableCell>
                        <TableCell>{new Date(pharmacy.updated_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                    {invalidAddresses?.providers.map((provider) => (
                      <TableRow key={`provider-${provider.id}`}>
                        <TableCell>
                          <Badge variant="outline">Provider</Badge>
                        </TableCell>
                        <TableCell>{provider.name}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {provider.address_formatted || "-"}
                        </TableCell>
                        <TableCell>{getStatusBadge(provider.address_verification_status)}</TableCell>
                        <TableCell>{new Date(provider.updated_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                    {invalidAddresses?.total === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-primary" />
                          All addresses verified!
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
