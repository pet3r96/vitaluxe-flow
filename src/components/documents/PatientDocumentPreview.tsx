import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PDFViewer } from "./PDFViewer";

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
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {documentName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          )}

          {!loading && canPreview && previewUrl && (
            <>
              {isPDF && (
                <PDFViewer 
                  url={previewUrl} 
                  onDownload={handleDownload}
                  className="flex-1"
                />
              )}
              {isImage && (
                <div className="flex-1 overflow-auto bg-muted/20 flex items-center justify-center p-4">
                  <img
                    src={previewUrl}
                    alt={documentName}
                    className="max-w-full max-h-full object-contain shadow-lg"
                  />
                </div>
              )}
            </>
          )}

          {!loading && !canPreview && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
              <FileText className="h-16 w-16" />
              <p>Preview not available for this file type</p>
              <p className="text-sm">Click the download button below to view the file</p>
              <Button onClick={handleDownload} className="mt-4">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          )}
        </div>

        {!loading && canPreview && (
          <div className="flex justify-end gap-2 p-6 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
