import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, Trash2, UserPlus, Eye, Edit } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { AssignDocumentDialog } from "./AssignDocumentDialog";
import { EditDocumentDialog } from "./EditDocumentDialog";
import { DocumentViewer } from "./DocumentViewer";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";

interface DocumentCardProps {
  document: any;
}

export function DocumentCard({ document }: DocumentCardProps) {
  const queryClient = useQueryClient();
  const [showAssign, setShowAssign] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showViewer, setShowViewer] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("provider-documents")
        .remove([document.storage_path]);

      if (storageError) throw storageError;

      // Delete record
      const { error } = await supabase
        .from("provider_documents" as any)
        .delete()
        .eq("id", document.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-documents"] });
      toast.success("Document deleted");
    },
    onError: () => {
      toast.error("Failed to delete document");
    },
  });

  const downloadDocument = async () => {
    try {
      const { data, error } = await supabase.storage
        .from("provider-documents")
        .createSignedUrl(document.storage_path, 60);

      if (error || !data) {
        console.error("Failed to create signed URL:", error);
        toast.error("Failed to generate download link");
        return;
      }

      // Create a direct download link (HIPAA compliant - no browser cache)
      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = document.document_name; // Force download instead of opening
      link.target = '_blank'; // Fallback for some browsers
      link.rel = 'noopener noreferrer'; // Security
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Document downloaded");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download document");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-success text-success-foreground";
      case "signed": return "bg-blue-500 text-white";
      case "reviewed": return "bg-orange-500 text-white";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{document.document_name}</h3>
              <p className="text-sm text-muted-foreground">
                {document.document_type.replace("_", " ")}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowViewer(true)}>
                  <Eye className="h-4 w-4 mr-2" />
                  View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={downloadDocument}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowEdit(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowAssign(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Assign to Patient
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => deleteMutation.mutate()}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Scope Badge - Practice vs Patient */}
            {document.assigned_patient_id ? (
              <Badge className="bg-green-500 text-white">
                Patient Document
              </Badge>
            ) : (
              <Badge className="bg-blue-500 text-white">
                Practice Document
              </Badge>
            )}
            
            <Badge className={getStatusColor(document.status)}>
              {document.status}
            </Badge>
            {document.tags?.map((tag: string) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>

          {/* Display assigned patients as badges */}
          {document.provider_document_patients && document.provider_document_patients.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {document.provider_document_patients.map((assignment: any) => (
                <Badge key={assignment.patient_id} variant="outline" className="text-xs">
                  👤 {assignment.patients?.name}
                </Badge>
              ))}
            </div>
          )}
          
          {/* Legacy single-patient assignment (if still used) */}
          {document.patients && !document.provider_document_patients?.length && (
            <div className="text-sm font-medium text-muted-foreground">
              Patient: {document.patients.name}
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            {format(new Date(document.created_at), "MMM d, yyyy")}
          </div>
        </CardContent>
      </Card>

      <AssignDocumentDialog
        documentId={document.id}
        open={showAssign}
        onOpenChange={setShowAssign}
      />
      
      <EditDocumentDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        document={document}
      />

      <DocumentViewer
        open={showViewer}
        onOpenChange={setShowViewer}
        document={document}
      />
    </>
  );
}