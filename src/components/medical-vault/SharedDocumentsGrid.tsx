import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Lock, Unlock, Download, Eye, Loader2, Filter, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useState, useEffect, useMemo } from "react";
import { PatientDocumentPreview } from "@/components/documents/PatientDocumentPreview";
import { realtimeManager } from "@/lib/realtimeManager";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface SharedDocumentsGridProps {
  patientAccountId: string;
  mode: 'patient' | 'practice';
}

export function SharedDocumentsGrid({ patientAccountId, mode }: SharedDocumentsGridProps) {
  const queryClient = useQueryClient();
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'patient' | 'practice'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sharedFilter, setSharedFilter] = useState<'all' | 'shared' | 'private'>('all');

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

  // Fetch provider documents assigned to this patient using RPC function
  const { data: providerDocs, isLoading: loadingProviderDocs } = useQuery({
    queryKey: ['shared-provider-documents', patientAccountId],
    queryFn: async () => {
      console.log('[SharedDocumentsGrid] Fetching provider documents for patient:', patientAccountId);
      
      const { data, error } = await supabase
        .rpc('get_patient_provider_documents', { p_patient_id: patientAccountId });
      
      if (error) {
        console.error('[SharedDocumentsGrid] Provider docs error:', error);
        throw error;
      }
      
      console.log('[SharedDocumentsGrid] Provider docs loaded:', data?.length || 0);
      return data || [];
    },
    onError: (error) => {
      console.error('[SharedDocumentsGrid] Failed to load provider documents:', error);
      toast.error('Failed to load practice documents. Please refresh the page.');
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

    realtimeManager.subscribe('provider_document_patients', () => {
      queryClient.invalidateQueries({ queryKey: ['shared-provider-documents', patientAccountId] });
    });
  }, [patientAccountId, queryClient]);

  const handlePreview = (doc: any, type: 'patient' | 'provider') => {
    setPreviewDoc({ ...doc, type });
    setPreviewOpen(true);
  };

  const handleDownload = async (doc: any) => {
    try {
      const bucketName = doc.docType === 'provider' ? 'provider-documents' : 'patient-documents';
      console.log('[SharedDocumentsGrid] Download attempt:', { 
        docType: doc.docType, 
        bucketName, 
        storagePath: doc.storage_path,
        documentName: doc.document_name 
      });

      const { data, error } = await supabase.functions.invoke('get-s3-signed-url', {
        body: {
          bucketName,
          filePath: doc.storage_path,
          expiresIn: 60 // 1 min expiry
        }
      });

      if (error) {
        console.error('[SharedDocumentsGrid] Signed URL error:', error);
        throw error;
      }

      const response = await fetch(data.signedUrl || data.signed_url);
      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.document_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({ 
        title: "Download Started", 
        description: "Document is downloading" 
      });
    } catch (error: any) {
      console.error('[SharedDocumentsGrid] Download error:', error);
      toast({ 
        title: "Download Failed", 
        description: error.message,
        variant: "destructive" 
      });
    }
  };

  // All hooks MUST be called before any conditional returns
  const allDocs = useMemo(() => [
    ...(patientDocs || []).map(d => ({ ...d, docType: 'patient' as const })),
    ...(providerDocs || []).map(d => ({ ...d, docType: 'provider' as const })),
  ], [patientDocs, providerDocs]);

  // Get unique document types for filter
  const documentTypes = useMemo(() => {
    const types = new Set<string>();
    allDocs.forEach(doc => {
      if (doc.document_type) {
        types.add(doc.document_type);
      }
    });
    return Array.from(types).sort();
  }, [allDocs]);

  // Apply filters
  const filteredDocs = useMemo(() => {
    return allDocs.filter(doc => {
      // Source filter
      if (sourceFilter === 'patient' && doc.docType !== 'patient') return false;
      if (sourceFilter === 'practice' && doc.docType !== 'provider') return false;

      // Type filter
      if (typeFilter !== 'all' && doc.document_type !== typeFilter) return false;

      // Shared status filter (only for patient docs)
      if (doc.docType === 'patient') {
        const sharedWithPractice = 'share_with_practice' in doc ? doc.share_with_practice : false;
        if (sharedFilter === 'shared' && !sharedWithPractice) return false;
        if (sharedFilter === 'private' && sharedWithPractice) return false;
      }

      return true;
    });
  }, [allDocs, sourceFilter, typeFilter, sharedFilter]);

  // Now handle loading state after all hooks
  if (loadingPatientDocs || loadingProviderDocs) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
      {/* Filter Controls */}
      <div className="space-y-3 mb-6">
        {/* Source Filter */}
        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Source:</span>
          <div className="flex gap-2">
            <Button
              variant={sourceFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSourceFilter('all')}
            >
              All
            </Button>
            <Button
              variant={sourceFilter === 'patient' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSourceFilter('patient')}
            >
              Patient Documents
            </Button>
            <Button
              variant={sourceFilter === 'practice' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSourceFilter('practice')}
            >
              Practice Documents
            </Button>
          </div>
        </div>

        {/* Document Type Filter */}
        {documentTypes.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Type:</span>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={typeFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTypeFilter('all')}
              >
                All Types
              </Button>
              {documentTypes.map(type => (
                <Button
                  key={type}
                  variant={typeFilter === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTypeFilter(type)}
                >
                  {type}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Shared Status Filter (only for patient docs) */}
        {sourceFilter !== 'practice' && (
          <div className="flex flex-wrap gap-2 items-center">
            <Share2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Status:</span>
            <div className="flex gap-2">
              <Button
                variant={sharedFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSharedFilter('all')}
              >
                All
              </Button>
              <Button
                variant={sharedFilter === 'shared' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSharedFilter('shared')}
              >
                Shared with Practice
              </Button>
              <Button
                variant={sharedFilter === 'private' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSharedFilter('private')}
              >
                Private Only
              </Button>
            </div>
          </div>
        )}

        {/* Results Count */}
        <div className="text-sm text-muted-foreground">
          Showing {filteredDocs.length} of {allDocs.length} document{allDocs.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Documents Grid */}
      {filteredDocs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No documents match the selected filters</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDocs.map((doc) => {
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
                    View
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 touch-target"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(doc);
                    }}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        </div>
      )}

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
