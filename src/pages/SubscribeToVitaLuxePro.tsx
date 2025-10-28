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
import { Loader2, Check, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { PaymentMethodSelector } from "@/components/subscription/PaymentMethodSelector";

type SubscriptionStep = 'terms' | 'payment' | 'confirming';

export default function SubscribeToVitaLuxePro() {
  const { user } = useAuth();
  const { refreshSubscription } = useSubscription();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<SubscriptionStep>('terms');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
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

  const handleAcceptTerms = () => {
    if (!agreedToTerms) {
      toast({
        title: "Agreement Required",
        description: "Please agree to the VitaLuxePro Practice Development Terms to continue.",
        variant: "destructive"
      });
      return;
    }
    setCurrentStep('payment');
  };

  const handlePaymentMethodSelected = (methodId: string) => {
    setSelectedPaymentMethodId(methodId);
  };

  const handleConfirmSubscription = async () => {
    if (!selectedPaymentMethodId) {
      toast({
        title: "Payment Method Required",
        description: "Please select a payment method to continue.",
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
      const { data, error } = await supabase.functions.invoke('subscribe-to-vitaluxepro', {
        body: { 
          practice_id: user.id,
          payment_method_id: selectedPaymentMethodId
        }
      }) as any;

      if (error) throw error;

      toast({
        title: "Welcome to VitaLuxePro! 🎉",
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

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8 gap-2">
      <div className={`flex items-center gap-2 ${currentStep === 'terms' ? 'text-primary' : 'text-muted-foreground'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
          currentStep === 'terms' ? 'border-primary bg-primary text-primary-foreground' : 
          currentStep === 'payment' || currentStep === 'confirming' ? 'border-primary bg-primary text-primary-foreground' : 
          'border-muted bg-background'
        }`}>
          {currentStep === 'payment' || currentStep === 'confirming' ? <Check className="h-4 w-4" /> : '1'}
        </div>
        <span className="text-sm font-medium">Terms</span>
      </div>
      <div className="w-12 h-px bg-border"></div>
      <div className={`flex items-center gap-2 ${currentStep === 'payment' ? 'text-primary' : 'text-muted-foreground'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
          currentStep === 'payment' ? 'border-primary bg-primary text-primary-foreground' : 
          currentStep === 'confirming' ? 'border-primary bg-primary text-primary-foreground' : 
          'border-muted bg-background'
        }`}>
          {currentStep === 'confirming' ? <Check className="h-4 w-4" /> : '2'}
        </div>
        <span className="text-sm font-medium">Payment</span>
      </div>
      <div className="w-12 h-px bg-border"></div>
      <div className={`flex items-center gap-2 ${currentStep === 'confirming' ? 'text-primary' : 'text-muted-foreground'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
          currentStep === 'confirming' ? 'border-primary bg-primary text-primary-foreground' : 'border-muted bg-background'
        }`}>
          3
        </div>
        <span className="text-sm font-medium">Confirm</span>
      </div>
    </div>
  );

  return (
    <div className="container max-w-[1165px] mx-auto py-12 px-4">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Sparkles className="h-8 w-8 text-amber-500" />
          <h1 className="text-4xl font-bold">VitaLuxePro</h1>
        </div>
        <p className="text-xl text-muted-foreground">
          Transform Your Practice with Complete Virtual Front Desk + EMR System
        </p>
      </div>

      {renderStepIndicator()}

      {/* Step 1: Terms & Features */}
      {currentStep === 'terms' && (
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
                    <span className="text-5xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">$250</span>
                    <span className="text-muted-foreground/70">/month</span>
                  </div>
                  <Badge className="bg-amber-500 hover:bg-amber-600 text-white">
                    7-Day Free Trial
                  </Badge>
                </div>
                <Separator />
                <div className="text-sm space-y-2 text-foreground">
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
                  <p className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    Automatic billing after trial
                  </p>
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
                      VitaLuxePro Practice Development Terms
                    </a>
                  </label>
                </div>

                <Button
                  onClick={handleAcceptTerms}
                  disabled={!agreedToTerms}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold h-12"
                >
                  Continue to Payment
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => navigate('/dashboard')}
                  className="w-full"
                >
                  Maybe Later
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Step 2: Payment Method Selection */}
      {currentStep === 'payment' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <PaymentMethodSelector
            onMethodSelected={handlePaymentMethodSelected}
            selectedMethodId={selectedPaymentMethodId}
          />

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setCurrentStep('terms')}
              className="flex-1"
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={() => setCurrentStep('confirming')}
              disabled={!selectedPaymentMethodId}
              className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold"
            >
              Continue to Confirmation
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Confirmation */}
      {currentStep === 'confirming' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Confirm Your Subscription</CardTitle>
              <CardDescription>
                Review your subscription details before starting your free trial
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                  <span className="font-medium">Subscription Plan</span>
                  <span className="font-semibold">VitaLuxePro</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                  <span className="font-medium">Price</span>
                  <div className="text-right">
                    <div className="font-semibold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                      $250/month
                    </div>
                    <Badge className="bg-amber-500 text-white text-xs mt-1">
                      After 7-day trial
                    </Badge>
                  </div>
                </div>
                <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                  <span className="font-medium">Today's Charge</span>
                  <span className="text-2xl font-bold text-green-600">$0.00</span>
                </div>
              </div>

              <Separator />

              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-2 text-sm">
                <p className="font-medium text-amber-900 dark:text-amber-100">
                  📅 Trial Period Details
                </p>
                <ul className="space-y-1 text-amber-800 dark:text-amber-200 ml-4">
                  <li>• Your 7-day free trial starts immediately</li>
                  <li>• Full access to all VitaLuxePro features</li>
                  <li>• First charge on {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}</li>
                  <li>• Cancel anytime during trial with no charge</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setCurrentStep('payment')}
              disabled={isProcessing}
              className="flex-1"
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={handleConfirmSubscription}
              disabled={isProcessing}
              className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold h-12"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Start Free Trial'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
