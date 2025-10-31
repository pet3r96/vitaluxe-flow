import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Lock, Unlock, Download, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { PatientDocumentPreview } from "@/components/documents/PatientDocumentPreview";
import { realtimeManager } from "@/lib/realtimeManager";
import { useQueryClient } from "@tanstack/react-query";

interface SharedDocumentsGridProps {
  patientAccountId: string;
  mode: 'patient' | 'practice';
}

export function SharedDocumentsGrid({ patientAccountId, mode }: SharedDocumentsGridProps) {
  const queryClient = useQueryClient();
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Fetch patient documents (shared with practice)
  const { data: patientDocs, isLoading: loadingPatientDocs } = useQuery({
    queryKey: ['shared-patient-documents', patientAccountId],
    queryFn: async () => {
      const query = supabase
        .from('patient_documents')
        .select('*')
        .eq('patient_id', patientAccountId)
        .order('created_at', { ascending: false });

      // For practice view, only show shared documents
      if (mode === 'practice') {
        query.eq('share_with_practice', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: 10000,
  });

  // Fetch provider documents assigned to this patient
  const { data: providerDocs, isLoading: loadingProviderDocs } = useQuery({
    queryKey: ['shared-provider-documents', patientAccountId],
    queryFn: async () => {
      // Map to legacy patient_id for the junction table if needed
      const { data: mapRow } = await supabase
        .from('v_patients_with_portal_status')
        .select('patient_id')
        .eq('patient_account_id', patientAccountId)
        .maybeSingle();
      const legacyPatientId = mapRow?.patient_id ?? patientAccountId;

      const { data, error } = await supabase
        .from('provider_documents')
        .select(`
          *,
          provider_document_patients!inner(patient_id)
        `)
        .eq('provider_document_patients.patient_id', legacyPatientId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 10000,
  });

  // Realtime subscriptions for immediate updates
  useEffect(() => {
    if (!patientAccountId) return;

    realtimeManager.subscribe('patient_documents', () => {
      queryClient.invalidateQueries({ queryKey: ['shared-patient-documents', patientAccountId] });
    });

    realtimeManager.subscribe('provider_documents', () => {
      queryClient.invalidateQueries({ queryKey: ['shared-provider-documents', patientAccountId] });
    });
  }, [patientAccountId, queryClient]);

  const handlePreview = (doc: any, type: 'patient' | 'provider') => {
    setPreviewDoc({ ...doc, type });
    setPreviewOpen(true);
  };

  if (loadingPatientDocs || loadingProviderDocs) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const allDocs = [
    ...(patientDocs || []).map(d => ({ ...d, docType: 'patient' as const })),
    ...(providerDocs || []).map(d => ({ ...d, docType: 'provider' as const })),
  ];

  if (allDocs.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No shared documents available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {allDocs.map((doc) => {
          const isPatient = doc.docType === 'patient';
          const sharedWithPractice = isPatient && 'share_with_practice' in doc ? doc.share_with_practice : false;
          
          return (
            <Card key={`${doc.docType}-${doc.id}`} className="hover:shadow-lg transition-all">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex gap-1">
                    {isPatient ? (
                      sharedWithPractice ? (
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                          <Unlock className="h-3 w-3 mr-1" />
                          Shared
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
                          <Lock className="h-3 w-3 mr-1" />
                          Private
                        </Badge>
                      )
                    ) : (
                      <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                        <FileText className="h-3 w-3 mr-1" />
                        Practice
                      </Badge>
                    )}
                  </div>
                </div>
                
                <h4 className="font-semibold text-sm mb-1 line-clamp-2">
                  {doc.document_name || 'Untitled'}
                </h4>
                
                {doc.document_type && (
                  <p className="text-xs text-muted-foreground mb-2">
                    {doc.document_type}
                  </p>
                )}
                
                <p className="text-xs text-muted-foreground mb-3">
                  Uploaded: {format(new Date(doc.created_at), 'MMM d, yyyy')}
                </p>

                {doc.notes && (
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                    {doc.notes}
                  </p>
                )}
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 touch-target"
                    onClick={() => handlePreview(doc, doc.docType)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">View</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {previewDoc && (
        <PatientDocumentPreview
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          documentName={previewDoc.document_name}
          storagePath={previewDoc.storage_path}
          bucketName={previewDoc.docType === 'patient' ? 'patient-documents' : 'provider-documents'}
          mimeType={previewDoc.mime_type}
        />
      )}
    </>
  );
}
