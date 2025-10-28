import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpCircle, XCircle } from "lucide-react";
import { CancelSubscriptionDialog } from "./CancelSubscriptionDialog";
import { useToast } from "@/hooks/use-toast";

interface SubscriptionActionsCardProps {
  subscription: any;
}

export function SubscriptionActionsCard({ subscription }: SubscriptionActionsCardProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const { toast } = useToast();

  const handleUpgrade = () => {
    toast({
      title: "Coming Soon",
      description: "Additional subscription tiers will be available soon.",
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Subscription Actions</CardTitle>
          <CardDescription>Manage your subscription settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleUpgrade}
          >
            <ArrowUpCircle className="h-4 w-4 mr-2" />
            Upgrade Plan
          </Button>
          
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
