import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface PaymentWithTermsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (termsAccepted: boolean) => void;
}

export const PaymentWithTermsDialog = ({ 
  open, 
  onOpenChange,
  onComplete 
}: PaymentWithTermsDialogProps) => {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsContent, setTermsContent] = useState<string>("");
  const [termsVersion, setTermsVersion] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTerms = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('terms_and_conditions' as any)
          .select('content, version')
          .eq('role', 'subscription')
          .eq('is_active', true)
          .order('version', { ascending: false })
          .limit(1)
          .single();

        if (error) throw error;
        
        if (data && typeof data === 'object') {
          const terms = data as any;
          setTermsContent(terms.content || '');
          setTermsVersion(terms.version || 'v1.0');
        }
      } catch (error) {
        console.error('Error fetching terms:', error);
        setTermsContent('Terms and conditions could not be loaded. Please contact support.');
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchTerms();
      setTermsAccepted(false);
    }
  }, [open]);

  const handleContinue = () => {
    if (termsAccepted) {
      onComplete(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Payment & Terms Agreement</DialogTitle>
          <DialogDescription>
            Please review and accept the subscription terms before adding your payment method.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="bg-muted rounded-lg p-4">
                <h4 className="font-semibold mb-2">VitaLuxePro Subscription</h4>
                <p className="text-sm text-muted-foreground">$99/month, billed monthly</p>
              </div>

              <div className="space-y-2">
                <Label className="font-semibold">Terms and Conditions ({termsVersion})</Label>
                <ScrollArea className="h-[200px] w-full rounded-md border p-4">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: termsContent }} />
                  </div>
                </ScrollArea>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="terms" 
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                />
                <Label 
                  htmlFor="terms"
                  className="text-sm font-normal cursor-pointer"
                >
                  I agree to the VitaLuxePro Subscription Terms and Conditions
                </Label>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleContinue}
            disabled={!termsAccepted || loading}
          >
            Continue to Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
