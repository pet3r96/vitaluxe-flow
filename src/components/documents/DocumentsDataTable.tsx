import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Eye, Download, Edit, UserPlus, Trash2, MoreVertical, FileText } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { AssignDocumentDialog } from "./AssignDocumentDialog";
import { EditDocumentDialog } from "./EditDocumentDialog";
import { DocumentViewer } from "./DocumentViewer";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

interface DocumentsDataTableProps {
  documents: any[];
  isLoading: boolean;
}

export function DocumentsDataTable({ documents, isLoading }: DocumentsDataTableProps) {
  const { effectivePracticeId } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [documentTypeFilter, setDocumentTypeFilter] = useState("all");
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showViewer, setShowViewer] = useState(false);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (document: any) => {
      const { error: storageError } = await supabase.storage
        .from("provider-documents")
        .remove([document.storage_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("provider_documents" as any)
        .delete()
        .eq("id", document.id);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      toast.success("Document deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["provider-documents"] });
    },
    onError: (error) => {
      console.error("Delete error:", error);
      toast.error("Failed to delete document");
    },
  });

  // Download handler
  const downloadDocument = async (doc: any) => {
    if (!doc?.storage_path) return;

    try {
      const { data, error } = await supabase.storage
        .from('provider-documents')
        .createSignedUrl(doc.storage_path, 60);

      if (error) throw error;

      // Fetch as blob and download (HIPAA compliant - no new tabs)
      const response = await fetch(data.signedUrl);
      if (!response.ok) {
        throw new Error('Failed to download document');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = doc.document_name;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Downloaded ${doc.document_name}`);
    } catch (error: any) {
      console.error('[DocumentsDataTable] Download error:', error);
      toast.error("Failed to download document");
    }
  };

  // Get unique document types from documents
  const documentTypes = useMemo(() => {
    const types = new Set<string>();
    documents?.forEach((doc) => {
      if (doc.document_type) types.add(doc.document_type);
    });
    return Array.from(types).sort();
  }, [documents]);

  // Filter logic
  const filteredDocuments = useMemo(() => {
    return documents?.filter((doc) => {
      // Search: document name, patient name, document type, tags
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        doc.document_name?.toLowerCase().includes(searchLower) ||
        doc.patients?.name?.toLowerCase().includes(searchLower) ||
        doc.provider_document_patients?.some((pdp: any) =>
          pdp.patients?.name?.toLowerCase().includes(searchLower)
        ) ||
        doc.document_type?.toLowerCase().includes(searchLower) ||
        doc.tags?.some((tag: string) => tag.toLowerCase().includes(searchLower));

      // Status filter
      const matchesStatus = statusFilter === "all" || doc.status === statusFilter;

      // Document type filter
      const matchesType =
        documentTypeFilter === "all" || doc.document_type === documentTypeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [documents, searchQuery, statusFilter, documentTypeFilter]);

  // Status counts for filter dropdown
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: filteredDocuments?.length || 0,
      uploaded: 0,
      pending: 0,
      reviewed: 0,
      signed: 0,
      completed: 0,
      archived: 0,
    };

    filteredDocuments?.forEach((doc) => {
      if (doc.status && counts.hasOwnProperty(doc.status)) {
        counts[doc.status]++;
      }
    });

    return counts;
  }, [filteredDocuments]);

  // Pagination
  const { currentPage, totalPages, startIndex, endIndex, goToPage, hasNextPage, hasPrevPage } =
    usePagination({ totalItems: filteredDocuments?.length || 0, itemsPerPage: 25 });

  const paginatedDocuments = filteredDocuments?.slice(startIndex, endIndex);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",
      reviewed: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
      signed: "bg-green-500/20 text-green-300 border border-green-500/30",
      completed: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
      archived: "bg-gray-500/20 text-gray-300 border border-gray-500/30",
    };
    return colors[status] || "bg-muted text-muted-foreground";
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 flex-1 max-w-sm" />
          <Skeleton className="h-10 w-[200px]" />
          <Skeleton className="h-10 w-[200px]" />
        </div>
        <div className="rounded-md border">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 m-4" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, patient, type, tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses ({statusCounts.all})</SelectItem>
            <SelectItem value="uploaded">Uploaded ({statusCounts.uploaded})</SelectItem>
            <SelectItem value="pending">Pending ({statusCounts.pending})</SelectItem>
            <SelectItem value="reviewed">Reviewed ({statusCounts.reviewed})</SelectItem>
            <SelectItem value="signed">Signed ({statusCounts.signed})</SelectItem>
            <SelectItem value="completed">Completed ({statusCounts.completed})</SelectItem>
            <SelectItem value="archived">Archived ({statusCounts.archived})</SelectItem>
          </SelectContent>
        </Select>
        <Select value={documentTypeFilter} onValueChange={setDocumentTypeFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {documentTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">Document Name</TableHead>
              <TableHead className="min-w-[120px]">Date Added</TableHead>
              <TableHead className="min-w-[150px]">Patient Name</TableHead>
              <TableHead className="min-w-[150px]">Document Type</TableHead>
              <TableHead className="min-w-[120px]">Status</TableHead>
              <TableHead className="min-w-[150px]">Tags</TableHead>
              <TableHead className="text-right min-w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedDocuments?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery || statusFilter !== "all" || documentTypeFilter !== "all"
                      ? "No documents found matching your filters"
                      : "No documents yet"}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              paginatedDocuments?.map((doc) => (
                <TableRow key={doc.id}>
                  {/* Document Name with Icon */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="font-medium truncate">{doc.document_name}</span>
                    </div>
                  </TableCell>

                  {/* Date Added */}
                  <TableCell className="text-sm">
                    {format(new Date(doc.created_at), "MMM d, yyyy")}
                  </TableCell>

                  {/* Patient Name */}
                  <TableCell>
                    {doc.assigned_patient_id && doc.patients?.name ? (
                      <span className="text-sm">{doc.patients.name}</span>
                    ) : doc.provider_document_patients?.length > 0 ? (
                      <div className="flex items-center gap-1">
                        <span className="text-sm truncate">
                          {doc.provider_document_patients[0].patients?.name || "Unknown"}
                        </span>
                        {doc.provider_document_patients.length > 1 && (
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            +{doc.provider_document_patients.length - 1}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Practice Document</span>
                    )}
                  </TableCell>

                  {/* Document Type */}
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {doc.document_type?.replace(/_/g, " ") || "Unknown"}
                    </Badge>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Badge className={getStatusColor(doc.status)}>
                      {doc.status || "pending"}
                    </Badge>
                  </TableCell>

                  {/* Tags */}
                  <TableCell>
                    {doc.tags?.length > 0 ? (
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-xs">
                          {doc.tags[0]}
                        </Badge>
                        {doc.tags.length > 1 && (
                          <span className="text-xs text-muted-foreground">
                            +{doc.tags.length - 1}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>

                  {/* Actions - 3 Dot Menu */}
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedDocument(doc);
                            setShowViewer(true);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => downloadDocument(doc)}>
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedDocument(doc);
                            setShowEdit(true);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedDocument(doc);
                            setShowAssign(true);
                          }}
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Assign to Patient
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteMutation.mutate(doc)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {filteredDocuments && filteredDocuments.length > 0 && (
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          totalItems={filteredDocuments.length}
          startIndex={startIndex}
          endIndex={Math.min(endIndex, filteredDocuments.length)}
        />
      )}

      {/* Dialogs */}
      {selectedDocument && (
        <>
          <AssignDocumentDialog
            documentId={selectedDocument.id}
            open={showAssign}
            onOpenChange={setShowAssign}
          />
          <EditDocumentDialog
            open={showEdit}
            onOpenChange={setShowEdit}
            document={selectedDocument}
          />
          <DocumentViewer
            open={showViewer}
            onOpenChange={setShowViewer}
            document={selectedDocument}
          />
        </>
      )}
    </div>
  );
}
