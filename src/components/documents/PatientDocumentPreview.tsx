import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface PatientDocumentPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentName: string;
  storagePath: string;
  bucketName: string;
  mimeType: string;
}

export function PatientDocumentPreview({
  open,
  onOpenChange,
  documentName,
  storagePath,
  bucketName,
  mimeType,
}: PatientDocumentPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && storagePath) {
      loadPreview();
    }
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [open, storagePath]);

  const loadPreview = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(storagePath, 300); // 5 min expiry for preview

      if (error) throw error;
      setPreviewUrl(data.signedUrl);
    } catch (error: any) {
      console.error("Preview error:", error);
      toast({
        title: "Preview Error",
        description: "Could not load preview. Try downloading instead.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(storagePath, 60);

      if (error) throw error;

      const response = await fetch(data.signedUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = documentName;
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

  const isPDF = mimeType === "application/pdf";
  const isImage = mimeType?.startsWith("image/");
  const canPreview = isPDF || isImage;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {documentName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {loading && (
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          )}

          {!loading && canPreview && previewUrl && (
            <div className="border rounded-lg overflow-hidden bg-muted">
              {isPDF && (
                <embed
                  src={previewUrl}
                  type="application/pdf"
                  className="w-full h-[600px]"
                />
              )}
              {isImage && (
                <img
                  src={previewUrl}
                  alt={documentName}
                  className="w-full h-auto max-h-[600px] object-contain"
                />
              )}
            </div>
          )}

          {!loading && !canPreview && (
            <div className="flex flex-col items-center justify-center h-96 gap-4 text-muted-foreground">
              <FileText className="h-16 w-16" />
              <p>Preview not available for this file type</p>
              <p className="text-sm">Click the download button below to view the file</p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
