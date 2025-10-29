import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface UploadFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadFormDialog({ open, onOpenChange }: UploadFormDialogProps) {
  const { effectivePracticeId } = useAuth();
  const queryClient = useQueryClient();
  const [formName, setFormName] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");
      if (!effectivePracticeId) throw new Error("No practice ID available");

      // Upload to storage
      const filePath = `${effectivePracticeId}/forms/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("provider-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create form record
      const { error: insertError } = await supabase
        .from("practice_forms" as any)
        .insert([{
          form_name: formName || file.name,
          form_type: "custom",
          form_schema: { version: "1.0", pdf_template: true } as any,
          is_pdf_template: true,
          pdf_storage_path: filePath,
          practice_id: effectivePracticeId,
        }]);

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["practice-forms"] });
      toast.success("PDF form uploaded successfully");
      setFormName("");
      setFile(null);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Failed to upload form: " + error.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload PDF Form</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Form Name</Label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g., Consent Form"
            />
          </div>

          <div>
            <Label>PDF File</Label>
            <Input
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => uploadMutation.mutate()}
            disabled={!file || uploadMutation.isPending}
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploadMutation.isPending ? "Uploading..." : "Upload"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
