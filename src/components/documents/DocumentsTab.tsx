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

      console.log('[DocumentsTab] Fetching BOTH practice and patient-shared documents for practice:', effectivePracticeId);

      // Fetch practice documents AND patient-shared documents in parallel
      const [practiceResult, patientSharedResult] = await Promise.allSettled([
        // 1. Practice documents from provider_documents table
        supabase
          .from('provider_documents' as any)
          .select(`
            id,
            practice_id,
            document_name,
            document_type,
            status,
            is_internal,
            storage_path,
            uploaded_by,
            created_at,
            updated_at,
            assigned_staff_id,
            provider_document_patients:provider_document_patients(document_id, patient_id)
          `)
          .eq('practice_id', effectivePracticeId)
          .order('created_at', { ascending: false }),
        
        // 2. Patient-shared documents via RPC
        supabase.rpc('get_provider_documents', {
          p_practice_id: effectivePracticeId
        })
      ]);

      // Process practice documents
      let practiceDocuments: any[] = [];
      if (practiceResult.status === 'fulfilled') {
        const { data, error } = practiceResult.value;
        if (error) {
          console.error('[DocumentsTab] Error fetching practice documents:', error);
        } else {
          practiceDocuments = (data || []).map((doc: any) => ({
            ...doc,
            source_type: 'practice_shared',
            assigned_patient_ids: (doc.provider_document_patients || [])
              .map((p: any) => p.patient_id)
              .filter(Boolean),
          }));
          console.log('[DocumentsTab] Practice documents loaded:', practiceDocuments.length);
        }
      } else {
        console.error('[DocumentsTab] Practice documents promise rejected:', practiceResult.reason);
      }

      // Process patient-shared documents
      let patientSharedDocuments: any[] = [];
      if (patientSharedResult.status === 'fulfilled') {
        const { data, error } = patientSharedResult.value;
        if (error) {
          console.warn('[DocumentsTab] RPC get_provider_documents failed (patient-shared docs unavailable):', error);
        } else {
          const parsed = data ? (typeof data === 'string' ? JSON.parse(data) : data) : [];
          patientSharedDocuments = (parsed as any[]).map(d => ({ 
            ...d, 
            source_type: d.source_type || 'patient_shared' 
          }));
          console.log('[DocumentsTab] Patient-shared documents loaded:', patientSharedDocuments.length);
        }
      } else {
        console.warn('[DocumentsTab] Patient-shared RPC promise rejected:', patientSharedResult.reason);
      }

      // Merge both document sources
      let allDocs = [...practiceDocuments, ...patientSharedDocuments];
      
      console.log('[DocumentsTab] Merged documents:', {
        total: allDocs.length,
        practice: practiceDocuments.length,
        patientShared: patientSharedDocuments.length
      });

      // CLIENT-SIDE SECURITY: Validate all documents belong to the correct practice
      if (effectivePracticeId && (effectiveRole === 'doctor' || effectiveRole === 'staff')) {
        const invalidDocuments = allDocs.filter((doc: any) => 
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
          allDocs = allDocs.filter((doc: any) => 
            !doc.practice_id || doc.practice_id === effectivePracticeId
          );
        }
      }
      
      console.log('[DocumentsTab] Final document count after security filter:', allDocs.length);
      
      return allDocs;
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
        // Patient-shared documents: either tagged as patient_shared OR have assigned patients
        if (doc.source_type !== 'patient_shared' && (!doc.assigned_patient_ids || doc.assigned_patient_ids.length === 0)) return false;
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