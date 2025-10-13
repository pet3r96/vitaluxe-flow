import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logApplicationError } from "@/lib/errorLogger";

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

  const handleDownloadReceipt = async () => {
    try {
      setIsGenerating(true);

      const { data, error } = await supabase.functions.invoke('generate-order-receipt', {
        body: { order_id: orderId }
      });

      if (error) {
        console.error('Error generating receipt:', error);
        throw new Error(error.message || 'Failed to generate receipt');
      }

      if (!data?.url) {
        throw new Error('No download URL received');
      }

      // Download the PDF
      const response = await fetch(data.url);
      if (!response.ok) {
        throw new Error('Failed to download receipt');
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

    } catch (error: any) {
      console.error('Receipt download error:', error);
      
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
