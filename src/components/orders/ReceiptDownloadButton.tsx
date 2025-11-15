import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logApplicationError } from "@/lib/errorLogger";
import { useAuth } from "@/hooks/useAuth";

interface ReceiptDownloadButtonProps {
  orderId: string;
  orderDate: string;
  practiceName: string;
  variant?: "ghost" | "outline" | "default";
  size?: "default" | "sm" | "lg" | "icon";
  showLabel?: boolean;
}

export const ReceiptDownloadButton = ({
  orderId,
  orderDate,
  practiceName,
  variant = "ghost",
  size = "sm",
  showLabel = false
}: ReceiptDownloadButtonProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const { effectiveUserId } = useAuth();

  const handleDownloadReceipt = async () => {
    try {
      setIsGenerating(true);

      // Get current session to pass Authorization header
      const { data: { session } } = await supabase.auth.getSession();
      
      console.log('[ReceiptDownloadButton] Invoking function with:', {
        orderId,
        orderDate,
        practiceName,
        effectiveUserId
      });
      
      const { data, error } = await supabase.functions.invoke('generate-order-receipt', {
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        },
        body: { 
          order_id: orderId,
          effectiveUserId
        }
      });

      console.log('[ReceiptDownloadButton] Function response:', {
        data,
        error,
        hasUrl: !!data?.url
      });

      if (error) {
        import('@/lib/logger').then(({ logger }) => {
          logger.error('Error generating receipt', error);
        });
        
        // Handle specific error cases with helpful messages
        let errorMessage = 'Failed to generate receipt. Please try again.';
        if (error.message?.includes('503')) {
          errorMessage = 'The receipt generator is starting up. Please try again in a moment.';
        } else if (error.message?.includes('Unauthorized') || error.message?.includes('401')) {
          errorMessage = 'Your session expired. Please sign in again.';
        } else if (error.message?.includes('403') || error.message?.includes('not authorized')) {
          errorMessage = 'You don\'t have access to this receipt.';
        } else if (error.message?.includes('404') || error.message?.includes('not found')) {
          errorMessage = 'Receipt not found.';
        }
        
        throw new Error(errorMessage);
      }

      // Handle direct URL download
      if (data?.url) {
        console.log('[ReceiptDownloadButton] Using direct URL download');
        const response = await fetch(data.url);
        if (!response.ok) {
          throw new Error('Failed to download receipt file');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = data.fileName || `receipt_${orderId.slice(0, 8)}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        toast({
          title: "Receipt downloaded",
          description: "Your receipt has been downloaded successfully."
        });
      } 
      // Handle base64 fallback
      else if (data?.base64) {
        console.log('[ReceiptDownloadButton] Using base64 fallback');
        const { downloadPdfFromBase64 } = await import('@/lib/pdfGenerator');
        downloadPdfFromBase64(
          data.base64, 
          data.fileName || `receipt_${orderId.slice(0, 8)}.pdf`
        );

        toast({
          title: "Receipt downloaded",
          description: "Receipt generated successfully using backup method."
        });
      } else {
        throw new Error('No download URL or data received from server');
      }

    } catch (error: any) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error('Receipt download error', error, logger.sanitize({ orderId }));
      });
      
      // Log to admin error logs
      await logApplicationError('receipt_download', error, {
        orderId,
        practiceName,
        orderDate,
        component: 'ReceiptDownloadButton',
      });
      
      toast({
        title: "Download failed",
        description: error.message || "Failed to download receipt. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleDownloadReceipt}
      disabled={isGenerating}
      title="Download Receipt"
    >
      {isGenerating ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileText className="h-4 w-4" />
      )}
      {showLabel && (
        <span className="ml-2">
          {isGenerating ? "Generating..." : "Download Receipt"}
        </span>
      )}
    </Button>
  );
};
