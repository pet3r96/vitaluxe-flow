import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { realtimeManager } from "@/lib/realtimeManager";
import { Button } from "@/components/ui/button";
import { Upload, Filter } from "lucide-react";
import { DocumentUploadDialog } from "./DocumentUploadDialog";
import { DocumentsDataTable } from "./DocumentsDataTable";
import { DocumentFilters } from "./DocumentFilters";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";

export function DocumentsTab() {
  const { effectivePracticeId } = useAuth();
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    patientId: "all",
    documentType: "all",
    status: "all",
    dateFrom: "",
    dateTo: "",
    uploadedBy: "all",
    isInternal: "all",
    assignedStaffId: "all",
  });

  const { data: documents, isLoading } = useQuery({
    queryKey: ["provider-documents", effectivePracticeId, filters],
    queryFn: async () => {
      if (!effectivePracticeId) return [];
      
      let query = supabase
        .from("provider_documents" as any)
        .select(`
          *,
          patients(name),
          provider_document_patients(
            patient_id,
            patients(name)
          )
        `)
        .eq("practice_id", effectivePracticeId)
        .order("created_at", { ascending: false });

      if (filters.patientId && filters.patientId !== "all") {
        query = query.eq("assigned_patient_id", filters.patientId);
      }
      if (filters.documentType && filters.documentType !== "all") {
        query = query.eq("document_type", filters.documentType);
      }
      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters.dateFrom) {
        query = query.gte("created_at", filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte("created_at", filters.dateTo);
      }
      if (filters.uploadedBy && filters.uploadedBy !== "all") {
        query = query.eq("uploaded_by", filters.uploadedBy);
      }
      if (filters.isInternal && filters.isInternal !== "all") {
        query = query.eq("is_internal", filters.isInternal === "true");
      }
      if (filters.assignedStaffId && filters.assignedStaffId !== "all") {
        query = query.eq("assigned_staff_id", filters.assignedStaffId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
    enabled: !!effectivePracticeId,
    staleTime: 0,
  });

  // Real-time subscription for instant document updates
  useEffect(() => {
    if (!effectivePracticeId) return;

    realtimeManager.subscribe('provider_documents');
    realtimeManager.subscribe('provider_document_patients');

    return () => {
      // Manager handles cleanup
    };
  }, [effectivePracticeId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowFilters(!showFilters)} variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>
        <Button onClick={() => setShowUpload(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {showFilters && (
        <DocumentFilters filters={filters} onFiltersChange={setFilters} />
      )}

      <DocumentsDataTable documents={documents || []} isLoading={isLoading} />

      <DocumentUploadDialog open={showUpload} onOpenChange={setShowUpload} />
    </div>
  );
}