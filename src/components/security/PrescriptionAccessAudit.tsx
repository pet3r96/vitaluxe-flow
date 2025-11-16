import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Search, Loader2 } from "lucide-react";
import { format } from "date-fns";

export const PrescriptionAccessAudit = () => {
  const [dateFilter, setDateFilter] = useState<string>("30d");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: prescriptionLogs, isLoading } = useQuery({
    queryKey: ["prescription-audit-logs", dateFilter],
    queryFn: async () => {
      const now = new Date();
      let cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      if (dateFilter === "7d") {
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (dateFilter === "90d") {
        cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      } else if (dateFilter === "1y") {
        cutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      }

      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("action_type", "prescription_accessed")
        .gte("created_at", cutoff.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const filteredLogs = prescriptionLogs?.filter(log => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const patientName = log.details && typeof log.details === 'object' && 'patient_name' in log.details ? log.details.patient_name as string : null;
    return (
      log.user_email?.toLowerCase().includes(search) ||
      patientName?.toLowerCase().includes(search) ||
      log.entity_id?.toLowerCase().includes(search)
    );
  });

  const exportToCSV = () => {
    if (!filteredLogs) return;

    const headers = [
      "Timestamp",
      "User Email",
      "User Role",
      "Order Line ID",
      "Patient Name",
      "Has Prescription",
      "Has Custom Dosage",
      "Has Custom Sig",
      "Pharmacy ID",
    ];

    const rows = filteredLogs.map(log => {
      const details = log.details && typeof log.details === 'object' ? log.details : {};
      return [
        format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss"),
        log.user_email || "N/A",
        log.user_role || "N/A",
        log.entity_id || "N/A",
        ('patient_name' in details ? details.patient_name as string : null) || "N/A",
        ('has_prescription' in details ? details.has_prescription : false) ? "Yes" : "No",
        ('has_custom_dosage' in details ? details.has_custom_dosage : false) ? "Yes" : "No",
        ('has_custom_sig' in details ? details.has_custom_sig : false) ? "Yes" : "No",
        ('assigned_pharmacy_id' in details ? details.assigned_pharmacy_id as string : null) || "N/A",
      ];
    });

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prescription-audit-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Prescription Access Audit Trail
            </CardTitle>
            <CardDescription>
              DEA-compliant audit log of all prescription data access (6-year retention)
            </CardDescription>
          </div>
          <Button onClick={exportToCSV} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export for Compliance
          </Button>
        </div>

        <div className="flex gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by patient name, user email, or order ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
              <SelectItem value="1y">Last Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredLogs && filteredLogs.length > 0 ? (
          <>
            <div className="mb-4 p-3 bg-muted rounded-md">
              <p className="text-sm font-medium">Compliance Information</p>
              <p className="text-xs text-muted-foreground mt-1">
                Showing {filteredLogs.length} prescription access{filteredLogs.length !== 1 ? "es" : ""} • 
                Records retained for 6 years per HIPAA requirements
              </p>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Accessed By</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Prescription Data</TableHead>
                  <TableHead>Pharmacy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
              {filteredLogs.map((log) => {
                const details = log.details && typeof log.details === 'object' ? log.details : {};
                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {format(new Date(log.created_at), "MMM dd, yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{log.user_email || "N/A"}</p>
                        <Badge variant="outline" className="text-xs">{log.user_role || "Unknown"}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {('patient_name' in details ? details.patient_name as string : null) || "N/A"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {('has_prescription' in details && details.has_prescription) && (
                          <Badge variant="secondary" className="text-xs">Rx File</Badge>
                        )}
                        {('has_custom_dosage' in details && details.has_custom_dosage) && (
                          <Badge variant="secondary" className="text-xs">Dosage</Badge>
                        )}
                        {('has_custom_sig' in details && details.has_custom_sig) && (
                          <Badge variant="secondary" className="text-xs">Sig</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {('assigned_pharmacy_id' in details && details.assigned_pharmacy_id) ? (
                        <Badge variant="outline">Assigned</Badge>
                      ) : (
                        <span className="text-xs">Not assigned</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              </TableBody>
            </Table>
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-2">No Prescription Access Logs</p>
            <p className="text-sm">No prescription data has been accessed in this time period.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
