import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Calendar, Check } from "lucide-react";
import { format } from "date-fns";

interface SubscriptionOverviewProps {
  subscription: any;
}

export function SubscriptionOverview({ subscription }: SubscriptionOverviewProps) {
  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      trial: "secondary",
      past_due: "destructive",
      canceled: "outline",
    };
    return variants[status] || "outline";
  };

  const features = [
    "Patient appointment booking with automated scheduling",
    "Secure HIPAA-compliant patient messaging",
    "Complete digital EMR and medical vault system",
    "Practice analytics and revenue dashboard",
    "Automated SMS appointment reminders",
    "Document management & Staff Management",
    "Multi-provider calendar with availability management",
    "Practice automation tools and workflows",
    "Patient portal with self-service capabilities"
  ];

  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Active Subscription</CardTitle>
          <CardDescription>You don't have an active VitaLuxePro subscription.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              VitaLuxePro
            </CardTitle>
            <CardDescription className="mt-1">Complete virtual front desk + EMR system</CardDescription>
          </div>
          <Badge variant={getStatusBadge(subscription.status)}>
            {subscription.status === 'trial' ? 'Free Trial' : subscription.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Monthly Price</p>
            <p className="text-2xl font-bold">${subscription.monthly_price || '99.99'} <span className="text-sm text-muted-foreground font-normal">+ processing fees</span></p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {subscription.status === 'trial' ? 'Trial Ends' : 'Next Billing Date'}
            </p>
            <p className="text-lg font-semibold">
              {subscription.trial_ends_at 
                ? format(new Date(subscription.trial_ends_at), 'MMM dd, yyyy')
                : subscription.current_period_end 
                  ? format(new Date(subscription.current_period_end), 'MMM dd, yyyy')
                  : 'N/A'}
            </p>
          </div>
        </div>

        {subscription.status === 'trial' && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-sm text-amber-900 dark:text-amber-100">
              Your free trial is active. Add a payment method before it ends to continue accessing all features.
            </p>
          </div>
        )}

        <div>
          <h4 className="text-sm font-semibold mb-3">Included Features:</h4>
          <ul className="grid gap-2">
            {features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
