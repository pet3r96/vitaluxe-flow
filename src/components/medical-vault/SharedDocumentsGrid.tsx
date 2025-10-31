import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Lock, Unlock, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useState } from "react";
import { PatientDocumentPreview } from "@/components/documents/PatientDocumentPreview";

interface SharedDocumentsGridProps {
  patientAccountId: string;
  mode: 'patient' | 'practice';
}

export function SharedDocumentsGrid({ patientAccountId, mode }: SharedDocumentsGridProps) {
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
        .order('uploaded_at', { ascending: false });

      // For practice view, only show shared documents
      if (mode === 'practice') {
        query.eq('share_with_practice', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch provider documents assigned to this patient
  const { data: providerDocs, isLoading: loadingProviderDocs } = useQuery({
    queryKey: ['shared-provider-documents', patientAccountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('provider_documents')
        .select(`
          *,
          provider_document_patients!inner(patient_id)
        `)
        .eq('provider_document_patients.patient_id', patientAccountId)
        .order('uploaded_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const handlePreview = (doc: any, type: 'patient' | 'provider') => {
    setPreviewDoc({ ...doc, type });
    setPreviewOpen(true);
  };

  if (loadingPatientDocs || loadingProviderDocs) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading documents...
      </div>
    );
  }

  const allDocs = [
    ...(patientDocs || []).map(d => ({ ...d, docType: 'patient' as const })),
    ...(providerDocs || []).map(d => ({ ...d, docType: 'provider' as const })),
  ];

  if (allDocs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No shared documents available
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    className="flex-1"
                    onClick={() => handlePreview(doc, doc.docType)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
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
          bucketName={previewDoc.type === 'patient' ? 'patient-documents' : 'provider-documents'}
          mimeType={previewDoc.mime_type}
        />
      )}
    </>
  );
}
