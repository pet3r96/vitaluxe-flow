import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

export default function AcceptTerms() {
  const { user, effectiveRole, effectiveUserId, isImpersonating, impersonatedUserName, checkPasswordStatus } = useAuth();
  const navigate = useNavigate();
  
  const [terms, setTerms] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Redirect admins away from this page (unless impersonating)
  useEffect(() => {
    if (effectiveRole === 'admin' && !isImpersonating) {
      setLoading(false);
      navigate('/');
    }
  }, [effectiveRole, isImpersonating, navigate]);

  useEffect(() => {
    if (!user || !effectiveRole || (effectiveRole === 'admin' && !isImpersonating)) return;

    const fetchTerms = async () => {
      let data: any = null;
      let error: any = null;

      // Special handling for patients - they use a separate table
      if (effectiveRole === 'patient') {
        const res = await supabase
          .from('patient_portal_terms')
          .select('*')
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle();
        data = res.data;
        error = res.error;
      } else {
        const res = await supabase
          .from('terms_and_conditions')
          .select('*')
          .eq('role', effectiveRole as any)
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle();
        data = res.data;
        error = res.error;
      }

      if (error) {
        import('@/lib/logger').then(({ logger }) => {
          logger.error('Error fetching terms', error);
        });
        toast.error("Failed to load terms and conditions");
        setTerms(null);
        setLoading(false);
        return;
      }

      setTerms(data);
      setLoading(false);
    };

    fetchTerms();
  }, [user, effectiveRole, isImpersonating, navigate]);

  useEffect(() => {
    const scrollAreaRoot = scrollRef.current;
    if (!scrollAreaRoot) return;
    
    const viewport = scrollAreaRoot.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
    if (!viewport) return;

    viewport.addEventListener('scroll', handleScroll);
    
    // Initial check in case content is short enough to not need scrolling
    handleScroll();
    
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [terms]);

  const handleScroll = () => {
    const scrollAreaRoot = scrollRef.current;
    if (!scrollAreaRoot) return;
    
    // Get the actual scrollable viewport inside ScrollArea
    const viewport = scrollAreaRoot.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
    if (!viewport) return;

    const scrollTop = viewport.scrollTop;
    const scrollHeight = viewport.scrollHeight - viewport.clientHeight;
    
    // Prevent division by zero
    if (scrollHeight <= 0) {
      setScrollProgress(100);
      setHasScrolledToBottom(true);
      return;
    }
    
    const progress = (scrollTop / scrollHeight) * 100;
    setScrollProgress(progress);

    // Consider scrolled to bottom if within 50px
    if (scrollHeight - scrollTop < 50) {
      setHasScrolledToBottom(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!signatureName.trim()) {
      toast.error("Please enter your full name");
      return;
    }

    if (!agreed) {
      toast.error("You must agree to the terms to continue");
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-terms-pdf', {
        body: {
          terms_id: terms.id,
          signature_name: signatureName.trim(),
          target_user_id: isImpersonating ? effectiveUserId : undefined,
        }
      });

      if (error) {
        const backendError = (data as any)?.error || (error as any)?.message || "Failed to accept terms";
        const details = (data as any)?.details;
        toast.error(details ? `${backendError} — ${typeof details === 'string' ? details : JSON.stringify(details)}` : backendError);
        return;
      }

      if (data.success) {
        // Set session flag to prevent re-prompts in this session
        const sessionKey = `vitaluxe_terms_ok_${effectiveUserId || user?.id}`;
        sessionStorage.setItem(sessionKey, new Date().toISOString());
        console.log('[AcceptTerms] Session flag set for user', effectiveUserId || user?.id);

        toast.success(isImpersonating 
          ? `Terms accepted for ${impersonatedUserName || 'impersonated user'}!`
          : "Terms accepted successfully!");
        
        // Force a refresh of password status with explicit user context
        await checkPasswordStatus(effectiveRole, effectiveUserId);
        
        navigate("/");
      } else {
        const backendError = (data as any)?.error || "Failed to accept terms";
        const details = (data as any)?.details;
        toast.error(details ? `${backendError} — ${typeof details === 'string' ? details : JSON.stringify(details)}` : backendError);
        return;
      }
    } catch (error: any) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error('Error accepting terms', error);
      });
      toast.error(error.message || "Failed to accept terms");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading terms...</p>
        </div>
      </div>
    );
  }

  if (!terms) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Terms and conditions not found for your role. Please contact support.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const canSubmit = hasScrolledToBottom && agreed && signatureName.trim() && !submitting;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle>{terms.title}</CardTitle>
          <CardDescription>
            Please read the terms and conditions carefully. You must scroll to the bottom and agree to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Admin Impersonation Notice */}
          {isImpersonating && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>You are viewing as {impersonatedUserName || 'an impersonated user'}</span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate('/')}
                  >
                    Skip Terms (Admin)
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Scroll Progress Indicator */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Scroll Progress</span>
              <span>{Math.round(scrollProgress)}%</span>
            </div>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${scrollProgress}%` }}
              />
            </div>
            {!hasScrolledToBottom && (
              <p className="text-sm text-muted-foreground">
                Scroll to the bottom to enable acceptance
              </p>
            )}
          </div>

          {/* Terms Content */}
          <ScrollArea 
            ref={scrollRef}
            className="h-[400px] w-full border rounded-md p-4"
          >
            <div className="prose prose-sm dark:prose-invert max-w-none terms-content">
              <ReactMarkdown>{terms.content}</ReactMarkdown>
            </div>
          </ScrollArea>

          {/* Acceptance Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                By signing below, you acknowledge that you have read and agree to these terms and conditions.
              </AlertDescription>
            </Alert>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="agree" 
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked as boolean)}
                disabled={!hasScrolledToBottom}
              />
              <Label 
                htmlFor="agree"
                className={!hasScrolledToBottom ? "text-muted-foreground" : ""}
              >
                I agree to the above terms and conditions
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="signature">
                Full Name (This will serve as your electronic signature)
              </Label>
              <Input
                id="signature"
                placeholder="Enter your full name"
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                disabled={!hasScrolledToBottom || !agreed}
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={!canSubmit}
            >
              {submitting ? "Processing..." : "I Accept and Sign"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}