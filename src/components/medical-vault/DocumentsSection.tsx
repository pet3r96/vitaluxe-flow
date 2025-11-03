import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Eye, Trash2, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { PatientDocumentPreview } from "@/components/documents/PatientDocumentPreview";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type PatientDocument = Database['public']['Tables']['patient_documents']['Row'];

interface DocumentsSectionProps {
  patientAccountId: string;
  mode: 'patient' | 'practice';
  canEdit: boolean;
}

export function DocumentsSection({ patientAccountId, mode, canEdit }: DocumentsSectionProps) {
  const queryClient = useQueryClient();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<PatientDocument | null>(null);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["patient-documents-vault", patientAccountId],
    queryFn: async () => {
      console.log('[DocumentsSection] Fetching documents for patient_account:', patientAccountId);
      const { data, error } = await supabase
        .from("patient_documents")
        .select("*")
        .eq("patient_id", patientAccountId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error('[DocumentsSection] Error fetching documents:', error);
        throw error;
      }
      
      console.log('[DocumentsSection] Found documents:', {
        count: data?.length || 0,
        patientAccountId,
        mode,
        documents: data?.map(d => ({
          id: d.id,
          name: d.document_name,
          shared: d.share_with_practice
        }))
      });
      
      return (data || []) as PatientDocument[];
    },
    enabled: !!patientAccountId,
  });

  const handlePreview = (doc: PatientDocument) => {
    setSelectedDocument(doc);
    setPreviewOpen(true);
  };

  const handleDownload = async (doc: PatientDocument) => {
    try {
      const { data, error } = await supabase.functions.invoke('get-s3-signed-url', {
        body: {
          bucketName: 'patient-documents',
          filePath: doc.storage_path,
          expiresIn: 300
        }
      });

      if (error) throw error;

      const signedUrl = data.signedUrl || data.signed_url;
      if (!signedUrl) throw new Error('No signed URL returned');

      // Download file
      const link = document.createElement('a');
      link.href = signedUrl;
      link.download = doc.document_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Download started",
        description: `Downloading ${doc.document_name}`,
      });
    } catch (error: any) {
      console.error('[DocumentsSection] Download error:', error);
      toast({
        title: "Download failed",
        description: error.message || "Could not download document",
        variant: "destructive",
      });
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const { error } = await supabase
        .from("patient_documents")
        .delete()
        .eq("id", documentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-documents-vault", patientAccountId] });
      toast({
        title: "Document deleted",
        description: "Document has been removed from the vault",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading documents...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documents
            <Badge variant="secondary" className="ml-auto">
              {documents.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents uploaded</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.document_name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{doc.document_type}</span>
                        <span>•</span>
                        <span>{format(new Date(doc.created_at), 'MMM d, yyyy')}</span>
                        {doc.share_with_practice && (
                          <>
                            <span>•</span>
                            <Badge variant="secondary" className="text-xs">
                              <Share2 className="h-3 w-3 mr-1" />
                              Shared
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePreview(doc)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(doc)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {canEdit && mode === 'patient' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(doc.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedDocument && (
        <PatientDocumentPreview
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          documentName={selectedDocument.document_name}
          storagePath={selectedDocument.storage_path}
          bucketName="patient-documents"
          mimeType={selectedDocument.mime_type}
        />
      )}
    </>
  );
}
