import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface DocumentFiltersProps {
  filters: {
    patientId: string;
    documentType: string;
    status: string;
    dateFrom: string;
    dateTo: string;
    uploadedBy: string;
    isInternal: string;
    assignedStaffId: string;
    source: string;
  };
  onFiltersChange: (filters: any) => void;
}

export function DocumentFilters({ filters, onFiltersChange }: DocumentFiltersProps) {
  // Get effectivePracticeId from context
  const { effectivePracticeId } = useAuth();

  const { data: patients } = useQuery({
    queryKey: ["patients-filter", effectivePracticeId],
    queryFn: async () => {
      if (!effectivePracticeId) return [];
      const { data, error } = await supabase
        .from("v_patients_with_portal_status")
        .select("patient_account_id, name")
        .eq("practice_id", effectivePracticeId)
        .order("name");
      if (error) throw error;
      // Map to expected format with 'id' field
      return data?.map(p => ({ id: p.patient_account_id, name: p.name })) || [];
    },
    enabled: !!effectivePracticeId,
  });

  const { data: staff } = useQuery({
    queryKey: ["staff-users", effectivePracticeId],
    queryFn: async () => {
      if (!effectivePracticeId) return [];
      
      // Get practice staff
      const { data: staffData, error: staffError } = await supabase
        .from("practice_staff")
        .select("user_id, profiles!inner(id, full_name)")
        .eq("practice_id", effectivePracticeId);
      
      if (staffError) throw staffError;

      // Get providers
      const { data: providerData, error: providerError } = await supabase
        .from("providers")
        .select("user_id, profiles!inner(id, full_name)")
        .eq("practice_id", effectivePracticeId);
      
      if (providerError) throw providerError;

      // Combine and dedupe
      const allStaff = [
        ...(staffData?.map((s: any) => ({ id: s.profiles.id, full_name: s.profiles.full_name })) || []),
        ...(providerData?.map((p: any) => ({ id: p.profiles.id, full_name: p.profiles.full_name })) || []),
      ];
      
      // Remove duplicates based on id
      const uniqueStaff = allStaff.filter((staff, index, self) =>
        index === self.findIndex((s) => s.id === staff.id)
      );
      
      return uniqueStaff.sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
    enabled: !!effectivePracticeId,
  });

  const handleReset = () => {
    onFiltersChange({
      patientId: "all",
      documentType: "all",
      status: "all",
      dateFrom: "",
      dateTo: "",
      uploadedBy: "all",
      isInternal: "all",
      assignedStaffId: "all",
      source: "all",
    });
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label>Patient</Label>
            <Select
              value={filters.patientId}
              onValueChange={(value) => onFiltersChange({ ...filters, patientId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All patients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All patients</SelectItem>
                {patients?.map((patient) => (
                  <SelectItem key={patient.id} value={patient.id}>
                    {patient.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Document Type</Label>
            <Select
              value={filters.documentType}
              onValueChange={(value) => onFiltersChange({ ...filters, documentType: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="lab_results">Lab Results</SelectItem>
                <SelectItem value="consents">Consents</SelectItem>
                <SelectItem value="prescriptions">Prescriptions</SelectItem>
                <SelectItem value="referrals">Referrals</SelectItem>
                <SelectItem value="insurance">Insurance</SelectItem>
                <SelectItem value="internal_docs">Internal Docs</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Status</Label>
            <Select
              value={filters.status}
              onValueChange={(value) => onFiltersChange({ ...filters, status: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="uploaded">Uploaded</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="signed">Signed</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>From Date</Label>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
            />
          </div>

          <div>
            <Label>To Date</Label>
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
            />
          </div>

          <div>
            <Label>Uploaded By</Label>
            <Select
              value={filters.uploadedBy}
              onValueChange={(value) => onFiltersChange({ ...filters, uploadedBy: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All uploaders" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All uploaders</SelectItem>
                {staff?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Visibility</Label>
            <Select
              value={filters.isInternal}
              onValueChange={(value) => onFiltersChange({ ...filters, isInternal: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All documents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All documents</SelectItem>
                <SelectItem value="false">Patient-visible</SelectItem>
                <SelectItem value="true">Internal only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Assigned Staff</Label>
            <Select
              value={filters.assignedStaffId}
              onValueChange={(value) => onFiltersChange({ ...filters, assignedStaffId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All staff</SelectItem>
                {staff?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Source</Label>
            <Select
              value={filters.source}
              onValueChange={(value) => onFiltersChange({ ...filters, source: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="my_uploads">My Uploads</SelectItem>
                <SelectItem value="practice_shared">Practice Shared</SelectItem>
                <SelectItem value="patient_shared">Patient Shared</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <X className="h-4 w-4 mr-2" />
            Reset Filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}