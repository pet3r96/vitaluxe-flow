import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, Sparkles, CreditCard, ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function SubscribeToVitaLuxePro() {
  const { user } = useAuth();
  const { isSubscribed, loading: subscriptionLoading, status, refreshSubscription } = useSubscription();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [termsContent, setTermsContent] = useState<string>("");
  const [loadingTerms, setLoadingTerms] = useState(false);

  // Redirect if already subscribed
  useEffect(() => {
    if (!subscriptionLoading && isSubscribed) {
      toast({
        title: "Already Subscribed",
        description: `You already have an ${status} VitaLuxePro subscription.`,
      });
      navigate('/dashboard');
    }
  }, [isSubscribed, subscriptionLoading, status, navigate, toast]);

  useEffect(() => {
    const fetchTerms = async () => {
      setLoadingTerms(true);
      try {
        // @ts-ignore - Temporary workaround for Supabase type depth issue
        const result = await supabase
          .from('terms_and_conditions')
          .select('content')
          .eq('role', 'subscription')
          .eq('active', true)
          .single();

        if (result.error) throw result.error;
        setTermsContent(result.data?.content || "Terms not available.");
      } catch (error) {
        console.error('Error fetching terms:', error);
        setTermsContent("Unable to load terms. Please contact support.");
      } finally {
        setLoadingTerms(false);
      }
    };

    fetchTerms();
  }, []);

  const features = [
    "Patient appointment booking with automated scheduling",
    "Secure HIPAA-compliant patient messaging",
    "Complete digital EMR and medical vault system",
    "Practice analytics and revenue dashboard",
    "Automated SMS appointment reminders via Twilio",
    "Document management & Staff Management",
    "Multi-provider calendar with availability management",
    "Practice automation tools and workflows",
    "Patient portal with self-service capabilities"
  ];

  const handleStartTrial = async () => {
    if (!agreedToTerms) {
      toast({
        title: "Agreement Required",
        description: "Please agree to the VitaLuxePro Practice Development Terms to continue.",
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
      const { data, error } = await supabase.functions.invoke('subscribe-to-vitaluxepro');

      if (error) {
        console.error('[SubscribeToVitaLuxePro] Edge function error:', error);
        toast({
          title: 'Subscription Failed',
          description: error.message || 'Unable to process subscription. Please try again.',
          variant: 'destructive'
        });
        return;
      }

      // Handle success response
      if (data?.success) {
        if (data.alreadySubscribed) {
          // Already has an active subscription
          toast({
            title: 'Already Subscribed',
            description: data.message || 'You already have an active VitaLuxePro subscription.',
          });
        } else {
          // New subscription created
          toast({
            title: 'Welcome to VitaLuxePro! 🎉',
            description: 'Your 7-day free trial has started. Add a payment method in your Profile before the trial ends.'
          });
        }

        await refreshSubscription();

        setTimeout(() => {
          navigate('/dashboard');
        }, 1200);
      } else if (data?.success === false) {
        // Business logic error (e.g., provider cannot subscribe)
        toast({
          title: 'Subscription Not Allowed',
          description: data.message || data.details || 'Unable to process subscription.',
          variant: 'destructive'
        });
      } else {
        // Unexpected response format
        toast({
          title: 'Subscription Failed',
          description: 'Unexpected response from server. Please try again.',
          variant: 'destructive'
        });
      }

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

  // Show loading while checking subscription status
  if (subscriptionLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-[1165px] mx-auto py-12 px-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-8 w-8 text-amber-500" />
            <h1 className="text-4xl font-bold">VitaLuxePro</h1>
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
          <Card className="bg-accent/50 border-border">
            <CardHeader>
              <CardTitle className="text-muted-foreground">Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-5xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">$99.99</span>
                  <span className="text-muted-foreground/70">/month + processing fees</span>
                </div>
                <Badge className="bg-amber-500 hover:bg-amber-600 text-white">
                  7-Day Free Trial
                </Badge>
              </div>
              <Separator />
              <div className="text-sm space-y-2 text-foreground">
                <p className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  No credit card required
                </p>
                <p className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  No Contracts
                </p>
                <p className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  Cancel anytime
                </p>
                <p className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  Full feature access during trial
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Start Your Free Trial</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
                <div className="flex items-start gap-2">
                  <CreditCard className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-blue-900 dark:text-blue-100">
                    You can add a payment method later in your Profile settings before the trial ends.
                  </p>
                </div>
              </div>

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
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowTermsDialog(true);
                    }}
                    className="underline text-primary hover:text-primary/80"
                  >
                    VitaLuxePro Practice Development Terms
                  </button>
                </label>
              </div>

              <Button
                onClick={handleStartTrial}
                disabled={!agreedToTerms || isProcessing}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold h-12"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting Trial...
                  </>
                ) : (
                  'Start 7-Day Free Trial'
                )}
              </Button>

              <Button
                variant="ghost"
                onClick={() => navigate('/dashboard')}
                disabled={isProcessing}
                className="w-full"
              >
                Maybe Later
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showTermsDialog} onOpenChange={setShowTermsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>VitaLuxePro Practice Development Terms</DialogTitle>
            <DialogDescription>
              Please review the terms and conditions for VitaLuxePro subscription
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            {loadingTerms ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{termsContent}</ReactMarkdown>
              </div>
            )}
          </ScrollArea>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowTermsDialog(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
