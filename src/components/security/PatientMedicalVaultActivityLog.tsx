import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Activity, Download, FileText, Shield, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface VaultHistory {
  id: string;
  patient_id: string;
  entity_type: string;
  action_type: string;
  entity_id: string;
  changed_by_user_id: string | null;
  changed_by_email: string | null;
  changed_by_role: string | null;
  changed_at: string;
  old_values: any;
  new_values: any;
  changed_fields: string[] | null;
  change_reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

interface PatientInfo {
  first_name: string;
  last_name: string;
}

const entityTypeLabels: Record<string, string> = {
  patient_medications: "Medications",
  patient_conditions: "Conditions",
  patient_allergies: "Allergies",
  patient_vitals: "Vitals",
  patient_immunizations: "Immunizations",
  patient_surgeries: "Surgeries",
  patient_pharmacies: "Pharmacies",
  patient_emergency_contacts: "Emergency Contacts"
};

const actionTypeColors: Record<string, string> = {
  INSERT: "bg-success/10 text-success",
  UPDATE: "bg-warning/10 text-warning",
  DELETE: "bg-destructive/10 text-destructive"
};

export const PatientMedicalVaultActivityLog = () => {
  const [searchPatient, setSearchPatient] = useState("");
  const [selectedEntityType, setSelectedEntityType] = useState<string>("all");
  const [selectedAction, setSelectedAction] = useState<string>("all");
  const [selectedRecord, setSelectedRecord] = useState<VaultHistory | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Fetch vault history with patient info (using type assertion for new table)
  const { data: historyData, isLoading } = useQuery({
    queryKey: ["patient-vault-history", searchPatient, selectedEntityType, selectedAction],
    queryFn: async () => {
      const supabaseAny = supabase as any;
      let queryBuilder = supabaseAny
        .from("patient_medical_vault_history")
        .select(`
          *,
          patient_accounts!patient_medical_vault_history_patient_id_fkey (
            first_name,
            last_name
          )
        `)
        .order("changed_at", { ascending: false })
        .limit(500);

      if (selectedEntityType !== "all") {
        queryBuilder = queryBuilder.eq("entity_type", selectedEntityType);
      }

      if (selectedAction !== "all") {
        queryBuilder = queryBuilder.eq("action_type", selectedAction);
      }

      const { data, error } = await queryBuilder;
      if (error) throw error;
      return (data || []) as unknown as (VaultHistory & { patient_accounts: PatientInfo })[];
    },
    staleTime: 30000
  });

  // Filter by patient name search
  const filteredData = useMemo(() => {
    if (!historyData) return [];
    if (!searchPatient) return historyData;

    const searchLower = searchPatient.toLowerCase();
    return historyData.filter((record) => {
      const fullName = `${record.patient_accounts.first_name} ${record.patient_accounts.last_name}`.toLowerCase();
      return fullName.includes(searchLower);
    });
  }, [historyData, searchPatient]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!historyData) return { total: 0, patients: 0, today: 0 };

    const uniquePatients = new Set(historyData.map(r => r.patient_id)).size;
    const today = historyData.filter(r => {
      const recordDate = new Date(r.changed_at);
      const todayDate = new Date();
      return recordDate.toDateString() === todayDate.toDateString();
    }).length;

    return {
      total: historyData.length,
      patients: uniquePatients,
      today
    };
  }, [historyData]);

  const handleExportCSV = () => {
    if (!filteredData || filteredData.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = ["Timestamp", "Patient", "Entity Type", "Action", "Changed By", "Role", "Changed Fields", "IP Address"];
    const rows = filteredData.map(record => [
      format(new Date(record.changed_at), "yyyy-MM-dd HH:mm:ss"),
      `${record.patient_accounts.first_name} ${record.patient_accounts.last_name}`,
      entityTypeLabels[record.entity_type] || record.entity_type,
      record.action_type,
      record.changed_by_email || "System",
      record.changed_by_role || "N/A",
      record.changed_fields?.join(", ") || "N/A",
      record.ip_address || "N/A"
    ]);

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `patient-vault-activity-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Activity log exported successfully");
  };

  const handleViewDetails = (record: VaultHistory & { patient_accounts: PatientInfo }) => {
    setSelectedRecord(record);
    setIsDetailOpen(true);
  };

  const renderComparisonValue = (value: any) => {
    if (value === null || value === undefined) return <span className="text-muted-foreground">null</span>;
    if (typeof value === "object") return <pre className="text-xs">{JSON.stringify(value, null, 2)}</pre>;
    return <span>{String(value)}</span>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Patient Medical Vault - Activity Log
              </CardTitle>
              <CardDescription>
                Complete immutable audit trail of all medical vault changes
              </CardDescription>
            </div>
            <Badge variant="outline" className="gap-1">
              <Shield className="h-3 w-3" />
              HIPAA Compliant
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <Input
              placeholder="Search by patient name..."
              value={searchPatient}
              onChange={(e) => setSearchPatient(e.target.value)}
              className="max-w-xs"
            />
            <Select value={selectedEntityType} onValueChange={setSelectedEntityType}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Entity Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(entityTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedAction} onValueChange={setSelectedAction}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="INSERT">INSERT</SelectItem>
                <SelectItem value="UPDATE">UPDATE</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleExportCSV} variant="outline" className="ml-auto gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Changes</p>
                    <p className="text-2xl font-bold">{stats.total.toLocaleString()}</p>
                  </div>
                  <Activity className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Unique Patients</p>
                    <p className="text-2xl font-bold">{stats.patients.toLocaleString()}</p>
                  </div>
                  <FileText className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Changes Today</p>
                    <p className="text-2xl font-bold">{stats.today.toLocaleString()}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-success" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Activity Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Changed By</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Loading activity log...
                    </TableCell>
                  </TableRow>
                ) : filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No activity records found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-mono text-xs">
                        {format(new Date(record.changed_at), "MMM dd, HH:mm:ss")}
                      </TableCell>
                      <TableCell>
                        {record.patient_accounts.first_name} {record.patient_accounts.last_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {entityTypeLabels[record.entity_type] || record.entity_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={actionTypeColors[record.action_type]}>
                          {record.action_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {record.changed_by_email || "System"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {record.changed_by_role || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(record)}
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Activity Record Details</DialogTitle>
            <DialogDescription>
              Immutable audit trail record - Cannot be modified or deleted
            </DialogDescription>
          </DialogHeader>
          
          {selectedRecord && (
            <div className="space-y-6">
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Timestamp</p>
                  <p className="text-sm">{format(new Date(selectedRecord.changed_at), "PPpp")}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Action Type</p>
                  <Badge className={actionTypeColors[selectedRecord.action_type]}>
                    {selectedRecord.action_type}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Changed By</p>
                  <p className="text-sm">{selectedRecord.changed_by_email || "System"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Role</p>
                  <Badge variant="secondary">{selectedRecord.changed_by_role || "N/A"}</Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">IP Address</p>
                  <p className="text-sm font-mono">{selectedRecord.ip_address || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Entity Type</p>
                  <Badge variant="outline">
                    {entityTypeLabels[selectedRecord.entity_type] || selectedRecord.entity_type}
                  </Badge>
                </div>
              </div>

              {/* Changed Fields */}
              {selectedRecord.changed_fields && selectedRecord.changed_fields.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Changed Fields</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedRecord.changed_fields.map((field) => (
                      <Badge key={field} variant="secondary">{field}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Before/After Comparison for UPDATE */}
              {selectedRecord.action_type === "UPDATE" && selectedRecord.old_values && selectedRecord.new_values && (
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold">Before & After Comparison</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-destructive">Before (Old Values)</p>
                      <div className="bg-muted p-4 rounded-lg space-y-2">
                        {selectedRecord.changed_fields?.map((field) => (
                          <div key={field} className="text-sm">
                            <span className="font-medium">{field}:</span>{" "}
                            {renderComparisonValue(selectedRecord.old_values[field])}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-success">After (New Values)</p>
                      <div className="bg-muted p-4 rounded-lg space-y-2">
                        {selectedRecord.changed_fields?.map((field) => (
                          <div key={field} className="text-sm">
                            <span className="font-medium">{field}:</span>{" "}
                            {renderComparisonValue(selectedRecord.new_values[field])}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Full Values for INSERT/DELETE */}
              {selectedRecord.action_type === "INSERT" && selectedRecord.new_values && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">New Record Data</p>
                  <div className="bg-muted p-4 rounded-lg">
                    <pre className="text-xs overflow-auto">{JSON.stringify(selectedRecord.new_values, null, 2)}</pre>
                  </div>
                </div>
              )}

              {selectedRecord.action_type === "DELETE" && selectedRecord.old_values && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Deleted Record Data</p>
                  <div className="bg-muted p-4 rounded-lg">
                    <pre className="text-xs overflow-auto">{JSON.stringify(selectedRecord.old_values, null, 2)}</pre>
                  </div>
                </div>
              )}

              {/* User Agent */}
              {selectedRecord.user_agent && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">User Agent</p>
                  <p className="text-xs font-mono bg-muted p-2 rounded">{selectedRecord.user_agent}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
