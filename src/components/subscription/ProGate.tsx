import { ReactNode } from "react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PRO_MONTHLY_PRICE_STR, TRIAL_DESCRIPTION } from "@/lib/pricing";

interface ProGateProps {
  children: ReactNode;
}

export function ProGate({ children }: ProGateProps) {
  const { isSubscribed, status } = useSubscription();
  const { effectiveRole } = useAuth();
  const navigate = useNavigate();

  console.log('[ProGate] Access check', { effectiveRole, isSubscribed, status });

  // Allow access during trial, active, or grace period
  const hasAccess = isSubscribed || ['trial', 'active'].includes(status || '');

  // Only show upgrade gate for doctors (practice owners)
  // Staff, providers, patients, pharmacy inherit access or don't need subscriptions
  if (!hasAccess && effectiveRole === 'doctor') {
    return (
      <div className="flex items-center justify-center min-h-[600px] p-6">
        <Card className="max-w-2xl w-full bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto rounded-full bg-primary/20 p-6 w-fit">
              <Lock className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-3xl">VitaLuxePro Feature</CardTitle>
            <CardDescription className="text-lg">
              This feature requires an active VitaLuxePro subscription
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4 text-center">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Sparkles className="h-5 w-5 text-primary" />
                <span>Start your {TRIAL_DESCRIPTION} today</span>
              </div>
              <p className="text-3xl font-bold text-primary">{PRO_MONTHLY_PRICE_STR}<span className="text-lg text-muted-foreground">/month</span></p>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-6 space-y-3">
              <h3 className="font-semibold text-lg">What you'll get:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Patient appointment scheduling and calendar management</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Secure patient messaging and communication</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Digital EMR and medical records vault</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Staff management and access controls</span>
                </li>
              </ul>
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                onClick={() => navigate('/my-subscription')} 
                className="flex-1"
                size="lg"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Subscribe Now
              </Button>
              <Button 
                onClick={() => navigate('/dashboard')} 
                variant="outline"
                size="lg"
              >
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
