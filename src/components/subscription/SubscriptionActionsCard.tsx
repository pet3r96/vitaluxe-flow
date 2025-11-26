import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpCircle, XCircle, Loader2 } from "lucide-react";
import { CancelSubscriptionDialog } from "./CancelSubscriptionDialog";
import { EnrollSubscriptionDialog } from "./EnrollSubscriptionDialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SubscriptionActionsCardProps {
  subscription: any;
}

export function SubscriptionActionsCard({ subscription }: SubscriptionActionsCardProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const { toast } = useToast();
  const { effectivePracticeId } = useAuth();
  const queryClient = useQueryClient();

  const handleEnrollClick = () => {
    // Open the enrollment consent dialog
    setShowEnrollDialog(true);
  };

  const handleConfirmEnroll = async (termsVersion: string) => {
    try {
      // First, record terms acceptance and authorization
      const { error: updateError } = await supabase
        .from('practice_subscriptions')
        .update({
          paid_terms_accepted_at: new Date().toISOString(),
          paid_terms_version: termsVersion
        })
        .eq('practice_id', effectivePracticeId);

      if (updateError) {
        throw new Error('Failed to record consent');
      }

      // Then process the payment
      const { data, error } = await supabase.functions.invoke(
        'upgrade-trial-to-active',
        { body: { practiceId: effectivePracticeId } }
      );
      
      if (error) throw error;
      
      if (data.success) {
        toast({
          title: "Subscription Activated!",
          description: "You're now enrolled in VitaLuxePro. Your card has been charged $149.99.",
        });
        
        // Refresh subscription data
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
        setTimeout(() => window.location.reload(), 1000);
      } else {
        throw new Error(data.error || 'Payment failed');
      }
    } catch (error: any) {
      toast({
        title: "Enrollment Failed",
        description: error.message || "Unable to process enrollment. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Subscription Actions</CardTitle>
          <CardDescription>Manage your subscription settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {subscription && subscription.status === 'trial' && (
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleEnrollClick}
            >
              <ArrowUpCircle className="h-4 w-4 mr-2" />
              Enroll in VitaLuxe Pro
            </Button>
          )}
          
          {subscription && subscription.status !== 'canceled' && (
            <Button
              variant="outline"
              className="w-full justify-start text-destructive hover:text-destructive"
              onClick={() => setShowCancelDialog(true)}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel Subscription
            </Button>
          )}

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Need help? Contact support at support@vitaluxe.com
            </p>
          </div>
        </CardContent>
      </Card>

      <CancelSubscriptionDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        subscription={subscription}
      />

      <EnrollSubscriptionDialog
        open={showEnrollDialog}
        onOpenChange={setShowEnrollDialog}
        onConfirmEnroll={handleConfirmEnroll}
        practiceId={effectivePracticeId || ''}
      />
    </>
  );
}
