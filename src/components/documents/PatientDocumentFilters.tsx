import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export type DocumentTypeFilter = "all" | "insurance" | "drivers_license" | "id" | "prescription" | "lab_result" | "imaging" | "referral" | "other";
export type SourceFilter = "all" | "patient_upload" | "provider_assigned";

interface PatientDocumentFiltersProps {
  documentType: DocumentTypeFilter;
  onDocumentTypeChange: (value: DocumentTypeFilter) => void;
  source: SourceFilter;
  onSourceChange: (value: SourceFilter) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  onClearFilters: () => void;
}

export function PatientDocumentFilters({
  documentType,
  onDocumentTypeChange,
  source,
  onSourceChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  onClearFilters,
}: PatientDocumentFiltersProps) {
  const hasActiveFilters = 
    documentType !== "all" || 
    source !== "all" || 
    dateFrom !== "" || 
    dateTo !== "";

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-card">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Filters</h3>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear All
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label>Document Type</Label>
          <Select value={documentType} onValueChange={onDocumentTypeChange}>
            <SelectTrigger>
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="insurance">Insurance Card</SelectItem>
              <SelectItem value="drivers_license">Driver's License</SelectItem>
              <SelectItem value="id">ID Card</SelectItem>
              <SelectItem value="prescription">Prescription</SelectItem>
              <SelectItem value="lab_result">Lab Result</SelectItem>
              <SelectItem value="imaging">Imaging</SelectItem>
              <SelectItem value="referral">Referral</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Date From</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Date To</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Source</Label>
          <RadioGroup value={source} onValueChange={(value) => onSourceChange(value as SourceFilter)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="source-all" />
              <Label htmlFor="source-all" className="font-normal cursor-pointer">All</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="patient_upload" id="source-patient" />
              <Label htmlFor="source-patient" className="font-normal cursor-pointer">Private</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="provider_assigned" id="source-provider" />
              <Label htmlFor="source-provider" className="font-normal cursor-pointer">Practice Shared</Label>
            </div>
          </RadioGroup>
        </div>
      </div>
    </div>
  );
}
