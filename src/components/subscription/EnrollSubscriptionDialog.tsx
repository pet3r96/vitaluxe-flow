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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { TermsAndConds } from "@/integrations/supabase/table-helpers";
import { Loader2, AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { logger } from "@/lib/logger";

interface EnrollSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmEnroll: (termsVersion: string) => Promise<void>;
  practiceId: string;
}

export const EnrollSubscriptionDialog = ({ 
  open, 
  onOpenChange,
  onConfirmEnroll,
  practiceId
}: EnrollSubscriptionDialogProps) => {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [chargeAuthorized, setChargeAuthorized] = useState(false);
  const [termsContent, setTermsContent] = useState<string>("");
  const [termsVersion, setTermsVersion] = useState<string>("v1.0");
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    const fetchTerms = async () => {
      try {
        setLoading(true);
        
        // Fetch subscription terms
        const { data, error } = await TermsAndConds()
          .select('content, version')
          .eq('role', 'subscription')
          .eq('is_active', true)
          .order('version', { ascending: false })
          .limit(1)
          .single();

        if (error) throw error;
        
        if (data) {
          setTermsContent(data.content || '');
          setTermsVersion(data.version || 'v1.0');
        }
      } catch (error) {
        logger.error('Error fetching subscription terms', error);
        setTermsContent('# VitaLuxePro Subscription Terms\n\nTerms and conditions could not be loaded. Please contact support at support@vitaluxe.com before enrolling.');
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchTerms();
      setTermsAccepted(false);
      setChargeAuthorized(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!termsAccepted || !chargeAuthorized) {
      return;
    }

    try {
      setEnrolling(true);
      await onConfirmEnroll(termsVersion);
      onOpenChange(false);
    } catch (error) {
      logger.error('Error during enrollment', error);
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[650px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Enroll in VitaLuxePro Subscription</DialogTitle>
          <DialogDescription>
            Review the subscription terms and authorize the monthly charge to activate your subscription.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Pricing Information */}
              <Alert className="border-primary">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-1">VitaLuxePro Monthly Subscription</div>
                  <div className="text-sm">
                    <strong>$149.99/month</strong> - Billed monthly on the same day each month
                  </div>
                </AlertDescription>
              </Alert>

              {/* Terms Content */}
              <div className="space-y-2">
                <Label className="font-semibold">Subscription Terms ({termsVersion})</Label>
                <ScrollArea className="h-[200px] w-full rounded-md border p-4 bg-muted/30">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                      {termsContent}
                    </ReactMarkdown>
                  </div>
                </ScrollArea>
              </div>

              {/* Required Consent Checkboxes */}
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-start space-x-3">
                  <Checkbox 
                    id="terms-acceptance" 
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                    className="mt-1"
                  />
                  <Label 
                    htmlFor="terms-acceptance"
                    className="text-sm font-normal cursor-pointer leading-normal"
                  >
                    I have read and agree to the VitaLuxePro Subscription Terms and Conditions
                  </Label>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox 
                    id="charge-authorization" 
                    checked={chargeAuthorized}
                    onCheckedChange={(checked) => setChargeAuthorized(checked as boolean)}
                    className="mt-1"
                  />
                  <Label 
                    htmlFor="charge-authorization"
                    className="text-sm font-semibold cursor-pointer leading-normal"
                  >
                    I authorize VitaLuxe to charge <strong>$149.99/month</strong> to my payment method on file, starting immediately
                  </Label>
                </div>
              </div>

              {/* Warning message */}
              {(!termsAccepted || !chargeAuthorized) && (
                <Alert variant="default" className="bg-muted">
                  <AlertDescription className="text-xs">
                    Both checkboxes must be selected to enroll in the subscription. Your card will be charged immediately upon enrollment.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={enrolling}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!termsAccepted || !chargeAuthorized || loading || enrolling}
          >
            {enrolling ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Confirm & Enroll'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
