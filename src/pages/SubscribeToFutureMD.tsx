import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, Sparkles } from "lucide-react";

export default function SubscribeToFutureMD() {
  const { user } = useAuth();
  const { refreshSubscription } = useSubscription();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const features = [
    "Patient appointment booking with automated scheduling",
    "Secure HIPAA-compliant patient messaging",
    "Complete digital EMR and medical vault system",
    "Practice analytics and revenue dashboard",
    "Automated SMS appointment reminders via Twilio",
    "AI-assisted patient triage and symptom checker",
    "Document management and e-signature workflows",
    "Multi-provider calendar with availability management",
    "Practice automation tools and workflows",
    "Patient portal with self-service capabilities"
  ];

  const handleSubscribe = async () => {
    if (!agreedToTerms) {
      toast({
        title: "Agreement Required",
        description: "Please agree to the FutureMD Practice Development Terms to continue.",
        variant: "destructive"
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Authentication Error",
        description: "Please sign in to subscribe.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('subscribe-to-futuremd', {
        body: { practice_id: user.id }
      }) as any;

      if (error) throw error;

      toast({
        title: "Welcome to FutureMD Pro! 🎉",
        description: "Your 7-day free trial has started. All premium features are now unlocked."
      });

      await refreshSubscription();

      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);

    } catch (error: any) {
      console.error('Subscription error:', error);
      toast({
        title: "Subscription Failed",
        description: error.message || "Unable to process subscription. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container max-w-4xl mx-auto py-12 px-4">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Sparkles className="h-8 w-8 text-amber-500" />
          <h1 className="text-4xl font-bold">FutureMD Pro</h1>
        </div>
        <p className="text-xl text-muted-foreground">
          Transform Your Practice with Complete Virtual Front Desk + EMR System
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>What's Included</CardTitle>
            <CardDescription>
              Everything you need to run a modern, efficient practice
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {features.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800">
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-4xl font-bold">$250</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <Badge className="bg-amber-500 hover:bg-amber-600 text-white">
                  7-Day Free Trial
                </Badge>
              </div>
              <Separator />
              <div className="text-sm space-y-2">
                <p>✓ No credit card required for trial</p>
                <p>✓ Cancel anytime</p>
                <p>✓ Full feature access during trial</p>
                <p>✓ Automatic billing after trial</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Terms & Agreement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="terms"
                  checked={agreedToTerms}
                  onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                />
                <label
                  htmlFor="terms"
                  className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  I agree to the{" "}
                  <a href="#" className="underline text-primary">
                    FutureMD Practice Development Terms
                  </a>
                </label>
              </div>

              <Button
                onClick={handleSubscribe}
                disabled={!agreedToTerms || isProcessing}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold h-12"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Start 7-Day Free Trial'
                )}
              </Button>

              <Button
                variant="ghost"
                onClick={() => navigate('/dashboard')}
                className="w-full"
                disabled={isProcessing}
              >
                Maybe Later
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
