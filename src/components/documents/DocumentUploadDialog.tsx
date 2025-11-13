import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [documentName, setDocumentName] = useState("");
  const [shareWithPractice, setShareWithPractice] = useState(true);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open]);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (files.length === 0) throw new Error("No files selected");
      if (!documentType) throw new Error("Document type is required");
      if (!documentName.trim()) throw new Error("Document name is required");

      const uploadedDocs = [];

      if (!effectivePracticeId) throw new Error("No practice ID available");

      for (let idx = 0; idx < files.length; idx++) {
        const file = files[idx];
        const customDocumentName = documentName.trim();
        
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
            document_name: customDocumentName,
            document_type: documentType,
            storage_path: filePath,
            file_size: file.size,
            mime_type: file.type,
            tags: tags ? tags.split(",").map(t => t.trim()) : [],
            notes: notes || null,
            patientIds: selectedPatientIds.length > 0 ? selectedPatientIds : undefined,
            is_internal: !shareWithPractice,
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
    setDocumentName("");
    setShareWithPractice(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
                <div className="mt-2 space-y-1 border rounded-md p-2 bg-muted/20">
                  {files.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 text-muted-foreground">{file.name}</span>
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
              <Label>Document Name *</Label>
              <Input
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
                placeholder="e.g., Patient Lab Results, Insurance Card, Consent Form"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This name will be used for all uploaded documents
              </p>
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

          <div className="flex items-start space-x-2 p-3 border rounded-lg">
            <Checkbox
              id="share-practice"
              checked={shareWithPractice}
              onCheckedChange={(checked) => setShareWithPractice(checked as boolean)}
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="share-practice"
                className="text-sm font-medium leading-none cursor-pointer"
              >
                Share with Practice (Providers and staff can view this document)
              </Label>
              <p className="text-xs text-muted-foreground">
                When unchecked, only you can see this document (private/internal).
              </p>
            </div>
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
              disabled={
                uploadMutation.isPending || 
                files.length === 0 || 
                !documentType ||
                !documentName.trim()
              }
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
