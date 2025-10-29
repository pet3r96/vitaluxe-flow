import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, Filter } from "lucide-react";
import { DocumentUploadDialog } from "./DocumentUploadDialog";
import { DocumentCard } from "./DocumentCard";
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
          patients(first_name, last_name)
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

    const documentsChannel = supabase
      .channel('documents-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'provider_documents',
          filter: `practice_id=eq.${effectivePracticeId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["provider-documents", effectivePracticeId, filters] });
        }
      )
      .subscribe();

    const assignmentsChannel = supabase
      .channel('document-assignments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'provider_document_patients',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["provider-documents", effectivePracticeId, filters] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(documentsChannel);
      supabase.removeChannel(assignmentsChannel);
    };
  }, [effectivePracticeId, filters, queryClient]);

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

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : documents && documents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc: any) => (
            <DocumentCard key={doc.id} document={doc} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No documents yet</h3>
          <p className="text-muted-foreground mb-4">
            Upload your first clinical document to get started
          </p>
          <Button onClick={() => setShowUpload(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        </div>
      )}

      <DocumentUploadDialog open={showUpload} onOpenChange={setShowUpload} />
    </div>
  );
}