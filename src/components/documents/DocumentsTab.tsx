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

  const { data: allDocuments = [], isLoading, error: queryError } = useQuery({
    queryKey: ["provider-documents", effectivePracticeId],
    queryFn: async () => {
      if (!effectivePracticeId) return [];

      console.log('[DocumentsTab] Fetching documents for practice:', effectivePracticeId);

      const { data, error } = await supabase.rpc('get_provider_documents', {
        p_practice_id: effectivePracticeId
      });

      if (error) {
        console.error('[DocumentsTab] RPC ERROR:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          practiceId: effectivePracticeId
        });
        throw error;
      }

      console.log('[DocumentsTab] RPC success, received documents:', data?.length || 0);

      // Parse JSONB response
      let documents = data ? (typeof data === 'string' ? JSON.parse(data) : data) : [];
      
      console.log('[DocumentsTab] Raw documents from RPC:', {
        count: documents?.length,
        practiceId: effectivePracticeId,
        patientSharedCount: documents.filter((d: any) => d.source_type === 'patient_shared').length,
        sampleDoc: documents.length > 0 ? documents[0] : null
      });
      
      // CLIENT-SIDE SECURITY: Validate all documents belong to the correct practice
      if (effectivePracticeId && (effectiveRole === 'doctor' || effectiveRole === 'staff')) {
        const invalidDocuments = documents.filter((doc: any) => 
          doc.practice_id && doc.practice_id !== effectivePracticeId
        );
        
        if (invalidDocuments.length > 0) {
          console.error('[DocumentsTab] SECURITY: Cross-practice documents detected', {
            count: invalidDocuments.length,
            userPractice: effectivePracticeId,
            invalidPractices: [...new Set(invalidDocuments.map((d: any) => d.practice_id))]
          });
          
          // Log suspicious access
          import('@/lib/auditLogger').then(({ logSuspiciousAccess }) => {
            invalidDocuments.forEach((doc: any) => {
              logSuspiciousAccess({
                userId: effectiveUserId || '',
                attemptedPracticeId: doc.practice_id,
                userPracticeId: effectivePracticeId,
                resource: 'provider_documents',
                details: { document_id: doc.id }
              });
            });
          });
          
          // Filter out invalid documents
          documents = documents.filter((doc: any) => 
            !doc.practice_id || doc.practice_id === effectivePracticeId
          );
        }
      }
      
      console.log('[DocumentsTab] After security filter:', {
        originalCount: data?.length || 0,
        filteredCount: documents.length,
        hiddenCount: (data?.length || 0) - documents.length
      });
      
      if (import.meta.env.DEV && documents?.length > 0) {
        console.log('[DocumentsTab] Sample document:', documents[0]);
        console.log('[DocumentsTab] has provider_document_patients?', !!documents[0]?.provider_document_patients);
        console.log('[DocumentsTab] has uploader_profile?', !!documents[0]?.uploader_profile);
      }
      
      if (effectiveRole === 'provider') {
        console.log('[DocumentsTab] Provider context:', {
          effectivePracticeId,
          effectiveUserId,
          documentCount: documents?.length
        });
      }
      
      return documents;
    },
    enabled: !!effectivePracticeId && (effectiveRole === 'admin' || effectiveRole === 'doctor' || effectiveRole === 'staff' || effectiveRole === 'provider'),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Client-side filters with pagination
  const { documents, totalPages } = useMemo(() => {
    if (!allDocuments?.length) return { documents: [], totalPages: 0 };

    const filtered = allDocuments.filter((doc: any) => {
      if (filters.patientId !== "all") {
        // Check if document is assigned to this specific patient
        const isAssignedToPatient = doc.assigned_patient_ids?.includes(filters.patientId);
        if (!isAssignedToPatient) return false;
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
        // Documents not assigned to patients and not internal
        if (doc.assigned_patient_ids?.length > 0 || doc.is_internal === true) return false;
      }
      if (filters.source === 'patient_shared') {
        // Documents that have been assigned to at least one patient
        if (!doc.assigned_patient_ids || doc.assigned_patient_ids.length === 0) return false;
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

    console.log('[DocumentsTab] Setting up realtime subscriptions for practice:', effectivePracticeId);

    realtimeManager.subscribe('provider_documents', (payload) => {
      console.log('[DocumentsTab] Realtime: provider_documents changed', payload);
    });
    
    realtimeManager.subscribe('provider_document_patients', (payload) => {
      console.log('[DocumentsTab] Realtime: provider_document_patients changed', payload);
    });

    return () => {
      console.log('[DocumentsTab] Cleaning up realtime subscriptions');
      // Manager handles cleanup
    };
  }, [effectivePracticeId]);

  return (
    <div className="space-y-4">
      {/* Error display */}
      {queryError && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive font-medium">Failed to load documents</p>
          <p className="text-xs text-muted-foreground mt-1">{queryError.message}</p>
        </div>
      )}

      {/* Debug info in dev mode */}
      {import.meta.env.DEV && (
        <div className="text-xs text-muted-foreground font-mono p-2 bg-muted rounded">
          <div>Role: {effectiveRole}</div>
          <div>Practice ID: {effectivePracticeId || 'None'}</div>
          <div>All Documents: {allDocuments?.length || 0}</div>
          <div>Filtered Documents: {documents?.length || 0}</div>
          <div>Patient-shared Documents: {allDocuments?.filter(d => d.source_type === 'patient_shared').length || 0}</div>
          <div>Current Filter Source: {filters.source}</div>
          {queryError && <div className="text-destructive">Error: {queryError.message}</div>}
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