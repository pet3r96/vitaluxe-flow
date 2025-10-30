import { useState, useEffect, useMemo } from "react";
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
  const { effectivePracticeId, effectiveRole, effectiveUserId } = useAuth();
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
    source: "all",
  });

  const { data: allDocuments = [], isLoading } = useQuery({
    queryKey: ["provider-documents", effectivePracticeId],
    queryFn: async () => {
      if (!effectivePracticeId) return [];

      const { data, error } = await supabase.rpc('get_provider_documents', {
        p_practice_id: effectivePracticeId
      });

      if (error) {
        console.error('[DocumentsTab] RPC error:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!effectivePracticeId && (effectiveRole === 'admin' || effectiveRole === 'doctor' || effectiveRole === 'staff'),
    staleTime: 0,
  });

  // Client-side filters
  const documents = useMemo(() => {
    if (!allDocuments?.length) return [];

    return allDocuments.filter((doc: any) => {
      if (filters.patientId !== "all") {
        const hasPatient = doc.provider_document_patients?.some(
          (pdp: any) => pdp.patient_id === filters.patientId
        );
        if (!hasPatient) return false;
      }

      if (filters.documentType !== "all" && doc.document_type !== filters.documentType) return false;
      if (filters.status !== "all" && doc.status !== filters.status) return false;
      if (filters.uploadedBy !== "all" && doc.uploaded_by !== filters.uploadedBy) return false;
      if (filters.isInternal !== "all" && doc.is_internal !== (filters.isInternal === "true")) return false;
      if (filters.assignedStaffId !== "all" && doc.assigned_staff_id !== filters.assignedStaffId) return false;
      
      if (filters.source === 'my_uploads' && doc.uploaded_by !== effectiveUserId) return false;
      if (filters.source === 'practice_shared' && doc.is_internal !== false) return false;

      return true;
    });
  }, [allDocuments, filters, effectiveUserId]);

  // Real-time subscription for instant document updates
  useEffect(() => {
    if (!effectivePracticeId && effectiveRole !== 'admin') return;

    realtimeManager.subscribe('provider_documents');
    realtimeManager.subscribe('provider_document_patients');

    return () => {
      // Manager handles cleanup
    };
  }, [effectivePracticeId]);

  return (
    <div className="space-y-4">
      {/* Debug info in dev mode */}
      {import.meta.env.DEV && (
        <div className="text-xs text-muted-foreground font-mono p-2 bg-muted rounded">
          <div>Role: {effectiveRole}</div>
          <div>Practice ID: {effectivePracticeId || 'None'}</div>
          <div>All Documents: {allDocuments?.length || 0}</div>
          <div>Filtered Documents: {documents?.length || 0}</div>
        </div>
      )}
      
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