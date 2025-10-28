import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, Trash2, UserPlus, Eye } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { AssignDocumentDialog } from "./AssignDocumentDialog";
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

  const deleteMutation = useMutation({
    mutationFn: async () => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("provider-documents")
        .remove([document.storage_path]);

      if (storageError) throw storageError;

      // Delete record
      const { error } = await supabase
        .from("provider_documents")
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
    const { data, error } = await supabase.storage
      .from("provider-documents")
      .createSignedUrl(document.storage_path, 60);

    if (error || !data) {
      toast.error("Failed to download document");
      return;
    }

    window.open(data.signedUrl, "_blank");
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
                <DropdownMenuItem onClick={downloadDocument}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
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
            <Badge className={getStatusColor(document.status)}>
              {document.status}
            </Badge>
            {document.tags?.map((tag: string) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>

          {document.patients && (
            <div className="text-sm text-muted-foreground">
              Assigned to: {document.patients.first_name} {document.patients.last_name}
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
    </>
  );
}