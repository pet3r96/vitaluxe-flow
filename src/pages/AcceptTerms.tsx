import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { parseEdgeFunctionError } from "@/types/jsonb";
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
import { logger } from "@/lib/logger";
import { usePagePerformance } from "@/hooks/usePagePerformance";

export default function AcceptTerms() {
  usePagePerformance('AcceptTerms');
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
      logger.info('[AcceptTerms] Fetching terms', { role: effectiveRole, hasUserId: !!user?.id, effectiveUserId });
      
      let data: any = null;
      let error: any = null;

      // All roles now use unified terms_and_conditions table
      logger.info('[AcceptTerms] Querying terms_and_conditions', { role: effectiveRole });
      const res = await supabase
        .from('terms_and_conditions')
        .select('*')
        .eq('role', effectiveRole as Database["public"]["Enums"]["app_role"])
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      data = res.data;
      error = res.error;
      logger.info('[AcceptTerms] Role terms query result', { 
        found: !!data, 
        error: error?.message,
        dataPreview: data ? { id: data.id, version: data.version, role: data.role } : null 
      });

      if (error) {
        logger.error('[AcceptTerms] Error fetching terms', error, { effectiveRole, userId: user?.id });
        toast.error(`Failed to load terms: ${error.message}`);
        setTerms(null);
        setLoading(false);
        return;
      }

      if (!data) {
        logger.warn('[AcceptTerms] No terms found for role', { effectiveRole });
        toast.error(`No terms found for role: ${effectiveRole}. Please contact support.`);
      } else {
        logger.info('[AcceptTerms] Terms loaded successfully', { termsId: data.id });
      }

      setTerms(data);
      setLoading(false);
    };

    fetchTerms();
  }, [user, effectiveRole, isImpersonating, navigate, effectiveUserId]);

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

    logger.info('[SECURITY] AcceptTerms submit started', {
      hasScrolledToBottom,
      agreed,
      hasSignature: !!signatureName.trim(),
      hasTermsId: !!terms?.id,
      effectiveUserId,
      effectiveRole,
      isImpersonating
    });

    if (!hasScrolledToBottom) {
      logger.warn('[SECURITY] Terms submit rejected - not scrolled to bottom', { effectiveUserId });
      toast.error("Please scroll to the bottom to read all terms");
      return;
    }

    if (!signatureName.trim()) {
      logger.warn('[SECURITY] Terms submit rejected - no signature', { effectiveUserId });
      toast.error("Please enter your full name");
      return;
    }

    if (!agreed) {
      logger.warn('[SECURITY] Terms submit rejected - not agreed', { effectiveUserId });
      toast.error("You must agree to the terms to continue");
      return;
    }

    if (!terms?.id) {
      logger.error('[SECURITY] Terms submit rejected - no terms ID', { effectiveUserId, effectiveRole });
      toast.error("Terms information missing");
      return;
    }

    setSubmitting(true);

    try {
      logger.info('[SECURITY] Invoking generate-terms-pdf', {
        termsId: terms.id,
        userId: effectiveUserId || user?.id,
        effectiveRole,
        isImpersonating
      });

      const { data, error } = await supabase.functions.invoke('generate-terms-pdf', {
        body: {
          terms_id: terms.id,
          signature_name: signatureName.trim(),
          target_user_id: isImpersonating ? effectiveUserId : undefined,
        }
      });

      if (error) {
        const errorData = parseEdgeFunctionError(data);
        const errorObj = parseEdgeFunctionError(error);
        const backendError = errorData.error || errorObj.message || "Failed to accept terms";
        const details = errorData.details;
        logger.error('[SECURITY] generate-terms-pdf FAILED', { 
          error: backendError, 
          details,
          termsId: terms.id,
          userId: effectiveUserId || user?.id
        });
        toast.error(details ? `${backendError} — ${typeof details === 'string' ? details : JSON.stringify(details)}` : backendError);
        return;
      }

      if (data.success) {
        logger.info('[SECURITY] Terms accepted successfully', { 
          userId: effectiveUserId || user?.id,
          termsId: terms.id,
          effectiveRole,
          isImpersonating
        });

        // Set session flag with TIMESTAMP for expiry checking (not ISO string)
        const sessionKey = `vitaluxe_terms_ok_${effectiveUserId || user?.id}`;
        sessionStorage.setItem(sessionKey, Date.now().toString());
        logger.info('[SECURITY] Set session flag with timestamp', { 
          sessionKey,
          timestamp: Date.now()
        });

        toast.success(isImpersonating 
          ? `Terms accepted for ${impersonatedUserName || 'impersonated user'}!`
          : "Terms accepted successfully!");

        // FREE MODE: Skip trial auto-enrollment (all features are free)
        // To re-enable, change `if (false &&` back to `if (`
        if (false && effectiveRole === 'doctor' && !isImpersonating) {
          try {
            logger.info('[AcceptTerms] Auto-enrolling practice in trial after terms acceptance');
            const { data: subData, error: subError } = await supabase.functions.invoke(
              'subscribe-to-vitaluxepro',
              { body: { autoEnroll: true } }
            );
            if (subError) {
              logger.error('[AcceptTerms] Auto-enrollment failed', subError);
            } else {
              const isNewTrial = subData && 
                !(subData as { alreadySubscribed?: boolean })?.alreadySubscribed;
              if (isNewTrial) {
                toast.success("Your 14-day free trial has started! 🎉", {
                  description: "Full access to all features. Add a payment method before day 14 to continue.",
                  duration: 8000,
                });
              }
            }
          } catch (e) {
            logger.error('[AcceptTerms] Auto-enrollment error', e);
            // Non-blocking - trial can be started later
          }
        }
        
        // Force a refresh of password status with explicit user context
        logger.info('[SECURITY] Re-checking password status after terms acceptance');
        await checkPasswordStatus(effectiveRole, effectiveUserId);
        
        navigate("/");
      } else {
        const errorData = parseEdgeFunctionError(data);
        const backendError = errorData.error || "Failed to accept terms";
        const details = errorData.details;
        logger.error('[SECURITY] Terms acceptance failed - no success flag', { 
          error: backendError,
          details,
          data 
        });
        toast.error(details ? `${backendError} — ${typeof details === 'string' ? details : JSON.stringify(details)}` : backendError);
        return;
      }
    } catch (error: any) {
      logger.error('[SECURITY] Unexpected error accepting terms', error, {
        userId: effectiveUserId || user?.id,
        termsId: terms?.id
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
            <div className="space-y-2">
              <p>Terms and conditions not found for your role: <strong>{effectiveRole}</strong></p>
              <p className="text-sm">User ID: {user?.id}</p>
              <p className="text-sm">Effective ID: {effectiveUserId}</p>
              <p className="text-sm mt-2">Please contact support with this information.</p>
            </div>
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
              <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{terms.content}</ReactMarkdown>
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