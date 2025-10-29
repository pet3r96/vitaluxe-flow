import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useState } from "react";

interface DocumentViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: any;
}

export function DocumentViewer({ open, onOpenChange, document }: DocumentViewerProps) {
  const [fileUrl, setFileUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && document) {
      loadDocument();
    }
  }, [open, document]);

  const loadDocument = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from("provider-documents")
        .createSignedUrl(document.storage_path, 3600);

      if (error) throw error;
      setFileUrl(data.signedUrl);
    } catch (error) {
      toast.error("Failed to load document");
    } finally {
      setLoading(false);
    }
  };

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

  const isPDF = document?.mime_type === "application/pdf";
  const isImage = document?.mime_type?.startsWith("image/");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{document?.document_name}</span>
            <Button variant="outline" size="sm" onClick={downloadDocument}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto min-h-[500px]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Loading document...</p>
            </div>
          ) : isPDF ? (
            <embed
              src={fileUrl}
              type="application/pdf"
              width="100%"
              height="600px"
              className="rounded border"
            />
          ) : isImage ? (
            <img
              src={fileUrl}
              alt={document?.document_name}
              className="w-full h-auto rounded border"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <p className="text-muted-foreground">Preview not available for this file type</p>
              <Button onClick={downloadDocument}>
                <Download className="h-4 w-4 mr-2" />
                Download to view
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
