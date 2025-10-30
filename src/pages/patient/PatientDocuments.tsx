import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Upload, Eye, Edit, Download, Trash2, EyeOff, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { PatientDocumentPreview } from "@/components/documents/PatientDocumentPreview";
import { PatientDocumentEditDialog } from "@/components/documents/PatientDocumentEditDialog";
import { PatientDocumentFilters, DocumentTypeFilter, SourceFilter } from "@/components/documents/PatientDocumentFilters";

interface UnifiedDocument {
  id: string;
  source: string;
  patient_id: string;
  document_name: string;
  document_type: string;
  storage_path: string;
  bucket_name: string;
  file_size: number;
  mime_type: string;
  notes: string | null;
  share_with_practice: boolean;
  custom_title: string | null;
  hidden_by_patient: boolean;
  is_provider_document: boolean;
  created_at: string;
  assigned_by: string | null;
  assignment_message: string | null;
}

const ITEMS_PER_PAGE = 25;

export default function PatientDocuments() {
  const { user, effectiveUserId } = useAuth();
  const queryClient = useQueryClient();

  // Upload form state
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>("");
  const [customTitle, setCustomTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [shareWithPractice, setShareWithPractice] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Filter state
  const [typeFilter, setTypeFilter] = useState<DocumentTypeFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Dialog state
  const [previewDoc, setPreviewDoc] = useState<UnifiedDocument | null>(null);
  const [editDoc, setEditDoc] = useState<UnifiedDocument | null>(null);

  // Get patient account
  const { data: patientAccount, isLoading: isLoadingAccount, error: accountError } = useQuery({
    queryKey: ["patient-account", effectiveUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_accounts")
        .select("id")
        .eq("user_id", effectiveUserId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!effectiveUserId,
  });

  // Fetch unified documents
  const { data: allDocuments = [], isLoading } = useQuery({
    queryKey: ["patient-unified-documents", patientAccount?.id],
    queryFn: async () => {
      if (!patientAccount?.id) return [];

      const { data, error } = await supabase.rpc('get_patient_unified_documents', {
        p_patient_id: patientAccount.id
      });

      if (error) throw error;
      return (data || []) as UnifiedDocument[];
    },
    enabled: !!patientAccount?.id,
  });

  // Apply filters
  const filteredDocuments = allDocuments.filter((doc) => {
    if (typeFilter !== "all" && doc.document_type !== typeFilter) return false;
    if (sourceFilter !== "all" && doc.source !== sourceFilter) return false;
    if (dateFrom && new Date(doc.created_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(doc.created_at) > new Date(dateTo)) return false;
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredDocuments.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedDocuments = filteredDocuments.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [typeFilter, sourceFilter, dateFrom, dateTo]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!patientAccount?.id) return;

    const patientDocsChannel = supabase
      .channel("patient-documents-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "patient_documents",
          filter: `patient_id=eq.${patientAccount.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["patient-unified-documents"] });
        }
      )
      .subscribe();

    const providerDocsChannel = supabase
      .channel("provider-document-patients-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "provider_document_patients",
          filter: `patient_id=eq.${patientAccount.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["patient-unified-documents"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(patientDocsChannel);
      supabase.removeChannel(providerDocsChannel);
    };
  }, [patientAccount?.id, queryClient]);

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file || !documentType || !patientAccount?.id) {
        const missing = [];
        if (!file) missing.push("file");
        if (!documentType) missing.push("document type");
        if (!patientAccount?.id) missing.push("patient account");
        throw new Error(`Missing required fields: ${missing.join(", ")}`);
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${effectiveUserId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("patient-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("patient_documents").insert({
        patient_id: patientAccount.id,
        document_name: file.name,
        document_type: documentType,
        storage_path: filePath,
        file_size: file.size,
        mime_type: file.type,
        notes: notes || null,
        share_with_practice: shareWithPractice,
        custom_title: documentType === "other" ? customTitle : null,
        uploaded_by: user?.id,
      });

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      toast({
        title: "Document Uploaded",
        description: "Your document has been uploaded successfully.",
      });
      setFile(null);
      setDocumentType("");
      setCustomTitle("");
      setNotes("");
      setShareWithPractice(true);
      queryClient.invalidateQueries({ queryKey: ["patient-unified-documents"] });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Could not upload document",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (doc: UnifiedDocument) => {
      if (doc.is_provider_document) {
        throw new Error("Cannot delete provider documents");
      }

      const { error: storageError } = await supabase.storage
        .from(doc.bucket_name)
        .remove([doc.storage_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("patient_documents")
        .delete()
        .eq("id", doc.id);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      toast({
        title: "Document Deleted",
        description: "Your document has been deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["patient-unified-documents"] });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Could not delete document",
        variant: "destructive",
      });
    },
  });

  // Hide mutation (for provider documents)
  const hideMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase
        .from("patient_documents")
        .update({ hidden_by_patient: true } as any)
        .eq("id", docId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Document Hidden",
        description: "The document has been hidden from your view.",
      });
      queryClient.invalidateQueries({ queryKey: ["patient-unified-documents"] });
    },
    onError: (error: any) => {
      toast({
        title: "Action Failed",
        description: error.message || "Could not hide document",
        variant: "destructive",
      });
    },
  });

  const handleUpload = () => {
    if (!file || !documentType) {
      toast({
        title: "Missing Information",
        description: "Please select a file and document type.",
        variant: "destructive",
      });
      return;
    }

    if (documentType === "other" && !customTitle.trim()) {
      toast({
        title: "Missing Title",
        description: "Please provide a custom title for 'Other' document type.",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate();
  };

  const handleDownload = async (doc: UnifiedDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from(doc.bucket_name)
        .createSignedUrl(doc.storage_path, 60);

      if (error) throw error;

      const response = await fetch(data.signedUrl);
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
        description: "Your document is being downloaded.",
      });
    } catch (error: any) {
      toast({
        title: "Download Failed",
        description: error.message || "Could not download document",
        variant: "destructive",
      });
    }
  };

  const getDocumentTypeBadge = (type: string, customTitle: string | null) => {
    const display = customTitle || type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    return <Badge variant="outline">{display}</Badge>;
  };

  const getSourceBadge = (source: string) => {
    if (source === "patient_upload") {
      return <Badge className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/20">My Upload</Badge>;
    }
    return <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">Practice Shared</Badge>;
  };

  const getShareBadge = (shareWithPractice: boolean, isProvider: boolean) => {
    if (isProvider) return <span className="text-sm text-muted-foreground">N/A</span>;
    if (shareWithPractice) {
      return <Badge className="bg-green-500/10 text-green-600">✓ Yes</Badge>;
    }
    return <Badge variant="secondary">Private</Badge>;
  };

  const clearFilters = () => {
    setTypeFilter("all");
    setSourceFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Documents</h1>
        <p className="text-muted-foreground">Upload and manage your medical documents</p>
      </div>

      {/* Upload Section */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-xl font-semibold mb-4">Upload New Document</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="file">Select File</Label>
              <Input
                id="file"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                disabled={uploading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="document-type">Document Type</Label>
              <Select value={documentType} onValueChange={setDocumentType} disabled={uploading}>
                <SelectTrigger id="document-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="insurance_card">Insurance Card</SelectItem>
                  <SelectItem value="drivers_license">Drivers License</SelectItem>
                  <SelectItem value="id_card">ID Card</SelectItem>
                  <SelectItem value="prescription">Prescription</SelectItem>
                  <SelectItem value="lab_result">Lab Result</SelectItem>
                  <SelectItem value="medical_record">Medical Record</SelectItem>
                  <SelectItem value="consent_form">Consent Form</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {documentType === "other" && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="custom-title">Custom Title</Label>
                <Input
                  id="custom-title"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Enter a custom title"
                  disabled={uploading}
                />
              </div>
            )}

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this document..."
                disabled={uploading}
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2 md:col-span-2">
              <Checkbox
                id="share"
                checked={shareWithPractice}
                onCheckedChange={(checked) => setShareWithPractice(checked as boolean)}
                disabled={uploading}
              />
              <Label
                htmlFor="share"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Share with Practice (Providers and staff can view this document)
              </Label>
            </div>
          </div>

          <Button
            onClick={handleUpload}
            disabled={!file || !documentType || uploading}
            className="mt-4"
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? "Uploading..." : "Upload Document"}
          </Button>
        </CardContent>
      </Card>

      {/* Filters */}
      <PatientDocumentFilters
        documentType={typeFilter}
        onDocumentTypeChange={setTypeFilter}
        source={sourceFilter}
        onSourceChange={setSourceFilter}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        onClearFilters={clearFilters}
      />

      {/* Document Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {startIndex + 1}-{Math.min(endIndex, filteredDocuments.length)} of {filteredDocuments.length} documents
        </p>
      </div>

      {/* Documents Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : paginatedDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <FileText className="h-16 w-16 mb-4" />
              <p className="text-lg">No documents found</p>
              <p className="text-sm">Upload your first document to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Shared w/ Practice</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedDocuments.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          {doc.document_name}
                        </div>
                      </TableCell>
                      <TableCell>{getDocumentTypeBadge(doc.document_type, doc.custom_title)}</TableCell>
                      <TableCell>{format(new Date(doc.created_at), "MMM d, yyyy")}</TableCell>
                      <TableCell>{getSourceBadge(doc.source)}</TableCell>
                      <TableCell>{getShareBadge(doc.share_with_practice, doc.is_provider_document)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPreviewDoc(doc)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditDoc(doc)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(doc)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {doc.is_provider_document ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => hideMutation.mutate(doc.id)}
                            >
                              <EyeOff className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this document?")) {
                                  deleteMutation.mutate(doc);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Preview Dialog */}
      {previewDoc && (
        <PatientDocumentPreview
          open={!!previewDoc}
          onOpenChange={(open) => !open && setPreviewDoc(null)}
          documentName={previewDoc.document_name}
          storagePath={previewDoc.storage_path}
          bucketName={previewDoc.bucket_name}
          mimeType={previewDoc.mime_type}
        />
      )}

      {/* Edit Dialog */}
      {editDoc && (
        <PatientDocumentEditDialog
          open={!!editDoc}
          onOpenChange={(open) => !open && setEditDoc(null)}
          document={editDoc}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["patient-unified-documents"] });
            setEditDoc(null);
          }}
        />
      )}
    </div>
  );
}
