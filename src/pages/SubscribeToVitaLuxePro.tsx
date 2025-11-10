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
import { useTheme } from "next-themes";
import logoLight from "@/assets/vitaluxe-logo-light.png";
import logoDark from "@/assets/vitaluxe-logo-dark-bg.png";
import { TrialExpiredDialog } from "@/components/subscription/TrialExpiredDialog";
import { PaymentWithTermsDialog } from "@/components/subscription/PaymentWithTermsDialog";

export default function SubscribeToVitaLuxePro() {
  const { user, effectiveRole } = useAuth();
  const { isSubscribed, loading: subscriptionLoading, status, refreshSubscription, gracePeriodEndsAt } = useSubscription();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme } = useTheme();
  const currentLogo = theme === "light" ? logoLight : logoDark;
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [termsContent, setTermsContent] = useState<string>("");
  const [loadingTerms, setLoadingTerms] = useState(false);
  const [showTrialExpiredDialog, setShowTrialExpiredDialog] = useState(false);
  const [showPaymentTermsDialog, setShowPaymentTermsDialog] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  // Redirect pharmacy users immediately - subscriptions are only for practices
  useEffect(() => {
    if (effectiveRole === 'pharmacy') {
      toast({
        title: "Not Applicable",
        description: "Pharmacy accounts don't require VitaLuxePro subscriptions. This is for medical practices only.",
      });
      navigate('/dashboard');
    }
  }, [effectiveRole, navigate, toast]);

  // Redirect staff members - only practice owners manage subscriptions
  useEffect(() => {
    if (effectiveRole === 'staff') {
      toast({
        title: "Not Available for Staff",
        description: "Your practice's subscription is managed by the practice owner. Please contact your doctor if you have questions.",
      });
      navigate('/dashboard');
    }
  }, [effectiveRole, navigate, toast]);

  // Redirect providers - check with their practice owner
  useEffect(() => {
    if (effectiveRole === 'provider') {
      toast({
        title: "Contact Your Practice",
        description: "Subscription management is handled by your parent practice. Please contact your practice administrator for access to Pro features.",
      });
      navigate('/dashboard');
    }
  }, [effectiveRole, navigate, toast]);

  // Show trial expired modal when needed
  useEffect(() => {
    if (!subscriptionLoading && status) {
      // Show blocking modal for expired trial or suspended subscription
      const shouldShowModal = 
        (status === 'trial' && !isSubscribed) || 
        status === 'suspended' || 
        status === 'expired';
      
      setShowTrialExpiredDialog(shouldShowModal);
      
      // Redirect if actively subscribed
      if (isSubscribed && status !== 'expired' && status !== 'suspended') {
        toast({
          title: "Already Subscribed",
          description: `You already have an ${status} VitaLuxePro subscription.`,
        });
        navigate('/dashboard');
      }
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

  const handleUpgrade = () => {
    setShowTrialExpiredDialog(false);
    setShowPaymentTermsDialog(true);
  };

  const handlePaymentTermsComplete = (termsAccepted: boolean) => {
    setShowPaymentTermsDialog(false);
    if (termsAccepted) {
      // Navigate to profile to add payment method
      navigate('/profile');
    }
  };

  const handleDeclineSubscription = async () => {
    setIsDeclining(true);
    try {
      const { error } = await supabase.functions.invoke('cancel-subscription');
      
      if (error) throw error;
      
      toast({
        title: "Subscription Cancelled",
        description: "Your subscription has been cancelled. You can restart your trial anytime.",
      });
      
      await refreshSubscription();
      setShowTrialExpiredDialog(false);
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error cancelling subscription:', error);
      toast({
        title: "Cancellation Failed",
        description: error.message || "Unable to cancel subscription. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsDeclining(false);
    }
  };

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
            description: 'Your 14-day free trial has started. Add a payment method in your Profile before the trial ends.'
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
      <div className="container max-w-[1165px] mx-auto py-6 sm:py-8 md:py-12 px-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-4 sm:mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="text-center mb-6 sm:mb-8">
          <div className="flex items-center justify-center mb-4">
            <img 
              src={currentLogo} 
              alt="Vitaluxe Services" 
              className="h-12 sm:h-16 md:h-20"
            />
          </div>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground px-4">
            Transform Your Medical Practice with Complete Virtual Front Desk + EMR System
          </p>
        </div>

      <div className="grid gap-4 sm:gap-6 md:grid-cols-3 mb-6 sm:mb-8">
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
                <div className="flex flex-col sm:flex-row items-baseline gap-1 sm:gap-2 mb-2">
                  <span className="text-4xl sm:text-5xl font-bold text-gold1">$149.99</span>
                  <span className="text-sm sm:text-base text-muted-foreground/70">/month + processing fees</span>
                </div>
                <Badge variant="gold">
                  14-Day Free Trial
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
              <CardTitle className="text-base">
                {!isSubscribed && status === 'trial' ? 'Trial Ended - Add Payment' : 'Start Your Free Trial'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isSubscribed && status === 'trial' ? (
                // Trial has expired - need payment
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <CreditCard className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-red-900 dark:text-red-100">
                      Your 14-day trial has ended. Please add a payment method in your Profile settings to continue using VitaLuxePro.
                    </p>
                  </div>
                </div>
              ) : (
                // New trial or reactivation
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <CreditCard className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-blue-900 dark:text-blue-100">
                      You can add a payment method later in your Profile settings before the trial ends.
                    </p>
                  </div>
                </div>
              )}

              {!isSubscribed && status === 'trial' ? (
                // Show link to profile/payment for expired trials
                <Button
                  onClick={() => navigate('/profile')}
                  variant="gold"
                  className="w-full font-semibold h-11 sm:h-12 text-sm sm:text-base"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Add Payment Method
                </Button>
              ) : (
                // Show normal trial start for new users
                <>
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
                    variant="gold"
                    className="w-full font-semibold h-11 sm:h-12 text-sm sm:text-base"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Starting Trial...
                      </>
                    ) : (
                      'Start 14-Day Free Trial'
                    )}
                  </Button>
                </>
              )}

              {/* Only show Maybe Later if not expired/suspended */}
              {!(!isSubscribed && status === 'trial') && status !== 'suspended' && (
                <Button
                  variant="ghost"
                  onClick={() => navigate('/dashboard')}
                  disabled={isProcessing}
                  className="w-full"
                >
                  Maybe Later
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Blocking Trial Expired Modal */}
      <TrialExpiredDialog
        open={showTrialExpiredDialog}
        onUpgrade={handleUpgrade}
        onDecline={handleDeclineSubscription}
        status={status || 'trial'}
        gracePeriodEndsAt={gracePeriodEndsAt}
        declining={isDeclining}
      />

      {/* Payment Terms Dialog */}
      <PaymentWithTermsDialog
        open={showPaymentTermsDialog}
        onOpenChange={setShowPaymentTermsDialog}
        onComplete={handlePaymentTermsComplete}
      />

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
