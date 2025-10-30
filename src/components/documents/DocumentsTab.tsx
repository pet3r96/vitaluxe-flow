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

  const { data: documents, isLoading } = useQuery({
    queryKey: ["provider-documents", effectivePracticeId, effectiveRole, effectiveUserId, filters],
    queryFn: async () => {
      const isAdmin = effectiveRole === 'admin';
      
      // Robust practice ID resolution
      let resolvedPracticeId = effectivePracticeId;
      
      if (!resolvedPracticeId && !isAdmin) {
        // Fallback: resolve practice ID based on role
        if (effectiveRole === 'doctor') {
          // Doctor is the practice owner
          resolvedPracticeId = effectiveUserId;
        } else if (effectiveRole === 'provider') {
          // Query providers table
          const { data: providerData } = await supabase
            .from("providers")
            .select("practice_id")
            .eq("user_id", effectiveUserId)
            .single();
          resolvedPracticeId = providerData?.practice_id;
        } else if (effectiveRole === 'staff') {
          // Query practice_staff table
          const { data: staffData } = await supabase
            .from("practice_staff")
            .select("practice_id")
            .eq("user_id", effectiveUserId)
            .single();
          resolvedPracticeId = staffData?.practice_id;
        }
      }
      
      // If no practice ID resolved and not admin, return empty
      if (!resolvedPracticeId && !isAdmin) return [];
      
      let query = supabase
        .from("provider_documents" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (resolvedPracticeId) {
        query = query.eq("practice_id", resolvedPracticeId);
      }

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
      if (error) {
        console.error("Query error:", error);
        throw error;
      }
      return data as any[];
    },
    enabled: effectiveRole === 'admin' || !!effectivePracticeId || !!effectiveUserId,
    staleTime: 0,
  });

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