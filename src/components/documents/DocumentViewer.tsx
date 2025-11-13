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
  bucketName?: string;
}

export function DocumentViewer({ open, onOpenChange, document, bucketName = 'provider-documents' }: DocumentViewerProps) {
  const [fileUrl, setFileUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && document) {
      loadDocument();
    }
  }, [open, document]);

  const loadDocument = async () => {
    if (!document?.storage_path) return;
    
    setLoading(true);
    try {
      // Use the get-s3-signed-url edge function for proper bucket routing
      const { data, error } = await supabase.functions.invoke('get-s3-signed-url', {
        body: {
          bucket: bucketName,
          path: document.storage_path,
          expiresIn: 3600
        }
      });

      if (error) throw error;
      if (!data?.signedUrl) throw new Error('No signed URL returned');
      
      setFileUrl(data.signedUrl);
    } catch (error: any) {
      console.error('[DocumentViewer] Failed to load:', error);
      toast.error("Failed to load document");
    } finally {
      setLoading(false);
    }
  };

  const downloadDocument = async () => {
    if (!document?.storage_path) return;

    try {
      // Use the get-s3-signed-url edge function for proper bucket routing
      const { data, error } = await supabase.functions.invoke('get-s3-signed-url', {
        body: {
          bucket: bucketName,
          path: document.storage_path,
          expiresIn: 3600
        }
      });

      if (error) throw error;
      if (!data?.signedUrl) throw new Error('No signed URL returned');

      // Fetch as blob and download (HIPAA compliant - no new tabs)
      const response = await fetch(data.signedUrl);
      if (!response.ok) {
        throw new Error('Failed to download document');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.document_name;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Document downloaded");
    } catch (error: any) {
      console.error('[DocumentViewer] Download error:', error);
      toast.error("Failed to download document");
    }
  };

  const isPDF = document?.mime_type === "application/pdf";
  const isImage = document?.mime_type?.startsWith("image/");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh]">
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
