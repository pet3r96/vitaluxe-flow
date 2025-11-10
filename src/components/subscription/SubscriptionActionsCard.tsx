import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpCircle, XCircle, Loader2 } from "lucide-react";
import { CancelSubscriptionDialog } from "./CancelSubscriptionDialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SubscriptionActionsCardProps {
  subscription: any;
}

export function SubscriptionActionsCard({ subscription }: SubscriptionActionsCardProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const { toast } = useToast();
  const { effectivePracticeId } = useAuth();
  const queryClient = useQueryClient();

  const handleUpgrade = async () => {
    try {
      setIsUpgrading(true);
      
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
        title: "Upgrade Failed",
        description: error.message || "Unable to process upgrade. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpgrading(false);
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
              onClick={handleUpgrade}
              disabled={isUpgrading}
            >
              {isUpgrading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing Payment...
                </>
              ) : (
                <>
                  <ArrowUpCircle className="h-4 w-4 mr-2" />
                  Enroll in VitaLuxe Pro
                </>
              )}
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
    </>
  );
}
