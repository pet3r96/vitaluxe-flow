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
  });

  const { data: response, isLoading } = useQuery({
    queryKey: ["provider-documents", effectivePracticeId, effectiveRole, effectiveUserId, filters],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('list-provider-documents', {
        body: {
          filters: {
            patientId: filters.patientId !== 'all' ? filters.patientId : undefined,
            documentType: filters.documentType !== 'all' ? filters.documentType : undefined,
            status: filters.status !== 'all' ? filters.status : undefined,
            dateFrom: filters.dateFrom || undefined,
            dateTo: filters.dateTo || undefined,
            uploadedBy: filters.uploadedBy !== 'all' ? filters.uploadedBy : undefined,
            isInternal: filters.isInternal !== 'all' ? filters.isInternal : undefined,
            assignedStaffId: filters.assignedStaffId !== 'all' ? filters.assignedStaffId : undefined,
          },
          pagination: { limit: 50, offset: 0 }
        }
      });

      if (error) {
        console.error('[DocumentsTab] Function error:', error);
        throw error;
      }

      return data?.documents || [];
    },
    enabled: effectiveRole === 'admin' || !!effectivePracticeId || !!effectiveUserId,
    staleTime: 0,
  });

  const documents = response || [];

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
          <div>Documents loaded: {documents?.length || 0}</div>
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