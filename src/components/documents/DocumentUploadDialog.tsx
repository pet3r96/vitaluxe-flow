import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiPatientSelect } from "./MultiPatientSelect";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface DocumentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocumentUploadDialog({ open, onOpenChange }: DocumentUploadDialogProps) {
  const { effectivePracticeId } = useAuth();
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [documentType, setDocumentType] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedPatientIds, setSelectedPatientIds] = useState<string[]>([]);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (files.length === 0) throw new Error("No files selected");
      if (!documentType) throw new Error("Document type is required");

      const uploadedDocs = [];

      if (!effectivePracticeId) throw new Error("No practice ID available");

      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${effectivePracticeId}/documents/${fileName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("provider-documents")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Create document record via edge function (bypasses RLS)
        const { data: result, error: createError } = await supabase.functions.invoke("create-provider-document", {
          body: {
            document_name: file.name,
            document_type: documentType,
            storage_path: filePath,
            file_size: file.size,
            mime_type: file.type,
            tags: tags ? tags.split(",").map(t => t.trim()) : [],
            notes: notes || null,
            patientIds: selectedPatientIds.length > 0 ? selectedPatientIds : undefined,
          },
        });

        if (createError) throw createError;

        uploadedDocs.push(result.document);
      }

      return uploadedDocs;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-documents", effectivePracticeId] });
      toast.success(`${files.length} document(s) uploaded successfully`);
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      // Parse edge function error response
      let errorMessage = "Failed to upload documents";
      
      if (error?.message) {
        try {
          // Try to parse JSON error from edge function
          const parsed = JSON.parse(error.message);
          errorMessage = parsed.error || parsed.message || errorMessage;
          if (parsed.code) {
            errorMessage = `${errorMessage} (${parsed.code})`;
          }
        } catch {
          // If not JSON, use message as-is
          errorMessage = error.message;
        }
      }
      
      console.error("Document upload error:", error);
      toast.error(errorMessage);
    },
  });

  const resetForm = () => {
    setFiles([]);
    setDocumentType("");
    setTags("");
    setNotes("");
    setSelectedPatientIds([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Documents</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Select Files</Label>
            <Input
              type="file"
              multiple
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            />
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <Upload className="h-4 w-4" />
                    <span className="flex-1">{file.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Document Type *</Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lab_results">Lab Results</SelectItem>
                <SelectItem value="referrals">Referrals</SelectItem>
                <SelectItem value="consents">Consents</SelectItem>
                <SelectItem value="prescriptions">Prescriptions</SelectItem>
                <SelectItem value="insurance">Insurance</SelectItem>
                <SelectItem value="internal_docs">Internal Docs</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Tags (comma-separated)</Label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="urgent, follow-up, reviewed"
            />
          </div>

          <div>
            <Label>Assign to Patients (optional)</Label>
            <MultiPatientSelect
              selectedPatientIds={selectedPatientIds}
              onSelectedChange={setSelectedPatientIds}
            />
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this document"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => uploadMutation.mutate()}
              disabled={uploadMutation.isPending || files.length === 0 || !documentType}
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
