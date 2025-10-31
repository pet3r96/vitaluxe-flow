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
  const [page, setPage] = useState(1);
  const itemsPerPage = 50;
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

      // Parse JSONB response
      const documents = data ? (typeof data === 'string' ? JSON.parse(data) : data) : [];
      
      if (import.meta.env.DEV && documents?.length > 0) {
        console.log('[DocumentsTab] Sample document:', documents[0]);
        console.log('[DocumentsTab] has provider_document_patients?', !!documents[0]?.provider_document_patients);
        console.log('[DocumentsTab] has uploader_profile?', !!documents[0]?.uploader_profile);
      }
      
      return documents;
    },
    enabled: !!effectivePracticeId && (effectiveRole === 'admin' || effectiveRole === 'doctor' || effectiveRole === 'staff'),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Client-side filters with pagination
  const { documents, totalPages } = useMemo(() => {
    if (!allDocuments?.length) return { documents: [], totalPages: 0 };

    const filtered = allDocuments.filter((doc: any) => {
      if (filters.patientId !== "all") {
        // For provider docs, check junction table
        if (doc.source_type === 'provider') {
          const hasPatient = doc.provider_document_patients?.some(
            (pdp: any) => pdp.patient_id === filters.patientId
          );
          if (!hasPatient) return false;
        }
        // For patient docs, check patient_uploader_id
        else if (doc.source_type === 'patient') {
          if (doc.patient_uploader_id !== filters.patientId) return false;
        }
      }

      if (filters.documentType !== "all" && doc.document_type !== filters.documentType) return false;
      if (filters.status !== "all" && doc.status !== filters.status) return false;
      if (filters.uploadedBy !== "all" && doc.uploaded_by !== filters.uploadedBy) return false;
      if (filters.isInternal !== "all" && doc.is_internal !== (filters.isInternal === "true")) return false;
      if (filters.assignedStaffId !== "all" && doc.assigned_staff_id !== filters.assignedStaffId) return false;
      
      // Enhanced source filtering
      if (filters.source === 'my_uploads') {
        if (doc.uploaded_by !== effectiveUserId) return false;
      }
      if (filters.source === 'practice_shared') {
        if (doc.source_type !== 'provider' || doc.is_internal !== false) return false;
      }
      if (filters.source === 'patient_shared') {
        if (doc.source_type !== 'patient') return false;
      }

      return true;
    });

    // Apply pagination
    const total = Math.ceil(filtered.length / itemsPerPage);
    const start = (page - 1) * itemsPerPage;
    const paginated = filtered.slice(start, start + itemsPerPage);

    return { documents: paginated, totalPages: total };
  }, [allDocuments, filters, effectiveUserId, page, itemsPerPage]);

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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      <DocumentUploadDialog open={showUpload} onOpenChange={setShowUpload} />
    </div>
  );
}