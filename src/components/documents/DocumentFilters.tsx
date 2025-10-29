import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  };
  onFiltersChange: (filters: any) => void;
}

export function DocumentFilters({ filters, onFiltersChange }: DocumentFiltersProps) {
  const { data: patients } = useQuery({
    queryKey: ["patients-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients" as any)
        .select("id, first_name, last_name")
        .order("last_name");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: staff } = useQuery({
    queryKey: ["staff-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .or("role.eq.admin,role.eq.provider")
        .order("full_name");
      
      if (error) throw error;
      return data;
    },
  });

  const handleReset = () => {
    onFiltersChange({
      patientId: "",
      documentType: "",
      status: "",
      dateFrom: "",
      dateTo: "",
      uploadedBy: "",
      isInternal: "",
      assignedStaffId: "",
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
                <SelectItem value="">All patients</SelectItem>
                {patients?.map((patient) => (
                  <SelectItem key={patient.id} value={patient.id}>
                    {patient.first_name} {patient.last_name}
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
                <SelectItem value="">All types</SelectItem>
                <SelectItem value="lab_result">Lab Result</SelectItem>
                <SelectItem value="clinical_note">Clinical Note</SelectItem>
                <SelectItem value="consent_form">Consent Form</SelectItem>
                <SelectItem value="prescription">Prescription</SelectItem>
                <SelectItem value="imaging">Imaging</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
                <SelectItem value="insurance">Insurance</SelectItem>
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
                <SelectItem value="">All statuses</SelectItem>
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
                <SelectItem value="">All uploaders</SelectItem>
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
                <SelectItem value="">All documents</SelectItem>
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
                <SelectItem value="">All staff</SelectItem>
                {staff?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name}
                  </SelectItem>
                ))}
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