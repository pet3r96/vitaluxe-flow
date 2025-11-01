import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { validatePasswordStrength } from "@/lib/passwordValidation";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, CheckCircle2, XCircle, Lock, Info } from "lucide-react";
import { logger } from "@/lib/logger";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";

export default function ChangePassword() {
  const { user, isImpersonating, impersonatedUserId, impersonatedUserName, clearImpersonation, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Get parameters from URL
  const tokenFromUrl = searchParams.get('token');
  const emailFromUrl = searchParams.get('email');
  
  // Determine if we're in token mode (unauthenticated password change)
  const [tokenMode] = useState(!!tokenFromUrl);
  
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  // State for user email fetched from token
  const [userEmailFromToken, setUserEmailFromToken] = useState<string | null>(null);
  
  // State to track if token has been verified (starts true if not in token mode)
  const [tokenVerified, setTokenVerified] = useState(!tokenMode);

  // Verify token immediately when in token mode - redirect if invalid/used
  useEffect(() => {
    if (tokenMode && tokenFromUrl) {
      setLoading(true);
      const verifyToken = async () => {
        try {
          const { data, error } = await supabase.functions.invoke('validate-password-token', {
            body: { token: tokenFromUrl }
          });
          
          if (error || !data?.valid) {
            console.error('Token validation failed:', error || 'Invalid token');
            toast.error("This password reset link is invalid, expired, or has already been used.");
            navigate("/auth?message=link_expired_or_used");
            return;
          }
          
          // Token is valid - set email and mark as verified
          if (data?.email) {
            setUserEmailFromToken(data.email);
          }
          setTokenVerified(true);
        } catch (error) {
          console.error('Token validation error:', error);
          toast.error("Failed to verify password reset link.");
          navigate("/auth?message=link_expired_or_used");
        } finally {
          setLoading(false);
        }
      };
      
      verifyToken();
    }
  }, [tokenMode, tokenFromUrl, navigate]);

  // Redirect to login if user is not authenticated (unless in token mode)
  useEffect(() => {
    // If token is provided, we're in token mode (no auth required)
    if (tokenFromUrl) {
      return; // Don't redirect, allow unauthenticated access
    }
    
    // No token - require authentication
    if (!user && emailFromUrl) {
      // User came from email link but is not logged in
      // Redirect to login with email pre-filled
      navigate(`/auth?email=${encodeURIComponent(emailFromUrl)}&message=Please log in with your temporary password to change it.`);
    } else if (!user) {
      // No user and no email parameter - redirect to login
      navigate('/auth');
    }
  }, [user, emailFromUrl, tokenFromUrl, navigate]);

  const validation = validatePasswordStrength(
    formData.newPassword,
    userEmailFromToken || user?.email || '',
    formData.currentPassword
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validation.valid) {
      toast.error("Password does not meet requirements");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      // TOKEN MODE: Use edge function with token (unauthenticated)
      if (tokenMode && tokenFromUrl) {
        const { data, error } = await supabase.functions.invoke('reset-password-with-token', {
          body: {
            token: tokenFromUrl,
            newPassword: formData.newPassword
          }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        toast.success("Password set successfully! Logging you in...");
        
        // Auto-login the user with their new password
        if (data?.email) {
          try {
            const { error: signInError } = await supabase.auth.signInWithPassword({
              email: data.email,
              password: formData.newPassword
            });
            
            if (signInError) {
              console.error('Auto-login failed:', signInError);
              // Fallback to redirect to login page
              setTimeout(() => {
                navigate("/auth");
              }, 2000);
            } else {
              // Successfully logged in, redirect to dashboard
              setTimeout(() => {
                navigate("/dashboard");
              }, 1000);
            }
          } catch (loginError) {
            console.error('Auto-login error:', loginError);
            // Fallback to redirect to login page
            setTimeout(() => {
              navigate("/auth");
            }, 2000);
          }
        } else {
          // No email returned, redirect to login
          setTimeout(() => {
            navigate("/auth");
          }, 2000);
        }
        return;
      }
      
      // ADMIN IMPERSONATION MODE
      if (isImpersonating && impersonatedUserId) {
        // ADMIN PATH: Use edge function to reset impersonated user's password
        const { data, error } = await supabase.functions.invoke('admin-reset-user-password', {
          body: {
            targetUserId: impersonatedUserId,
            newPassword: formData.newPassword
          }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        toast.success("Password changed successfully for impersonated user!");
        
        // Exit impersonation after password change
        await clearImpersonation();
        navigate("/");
      } else {
        // REGULAR USER PATH: Update own password
        const { error: passwordError } = await supabase.auth.updateUser({
          password: formData.newPassword
        });

        if (passwordError) throw passwordError;

        // Update password status in database
        const { error: statusError } = await supabase
          .from('user_password_status')
          .update({
            must_change_password: false,
            first_login_completed: true,
            password_last_changed: new Date().toISOString()
          })
          .eq('user_id', user?.id);

        if (statusError) throw statusError;

        // Clear temp_password flag from profiles table
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            temp_password: false
          })
          .eq('id', user?.id);

        if (profileError) {
          console.error('Failed to clear temp_password flag:', profileError);
          // Don't throw error - password change was successful, this is just cleanup
        }

        toast.success("Password changed successfully! You are now logged in.");
        
        // Navigate to dashboard after successful password change
        navigate("/dashboard");
      }
    } catch (error: any) {
      logger.error("Password change failed", error, { 
        user_id: user?.id,
        impersonating: isImpersonating,
        target_user_id: impersonatedUserId 
      });
      toast.error(error.message || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  // Show loading screen while verifying token
  if (tokenMode && !tokenVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardContent className="pt-12 pb-8 flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-lg font-medium text-foreground">Verifying password reset link...</p>
            <p className="text-sm text-muted-foreground">Please wait while we validate your request</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-3xl">
            {tokenMode 
              ? 'Set Your Password'
              : isImpersonating 
                ? 'Reset Impersonated User Password' 
                : 'Change Your Password'
            }
          </CardTitle>
          <CardDescription className="text-base">
            {tokenMode
              ? 'Set your new password below. This link will expire in 24 hours.'
              : isImpersonating 
                ? `You are changing the password for ${impersonatedUserName || 'the impersonated user'}. This will not affect your admin password.`
                : 'For your security and HIPAA compliance, you must change your temporary password before accessing the system.'
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {!isImpersonating && (
            <Alert className="mb-6 border-gold1/50 bg-gold1/10">
              <AlertDescription className="text-gold1">
                <strong>Security Notice:</strong> Your temporary password was sent via email. Please create a strong, unique password that meets all requirements below.
              </AlertDescription>
            </Alert>
          )}
          
          {isImpersonating && (
            <Alert className="mb-6 border-blue-500 bg-blue-50">
              <AlertDescription className="text-blue-800">
                <strong>Admin Notice:</strong> You are resetting the password for <strong>{impersonatedUserName}</strong>. Your admin password will remain unchanged.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Current Password - Hidden for admins impersonating AND token mode */}
            {!isImpersonating && !tokenMode && (
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current (Temporary) Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={formData.currentPassword}
                    onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                    required
                    className="pr-10"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  required
                  className="pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  className="pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Password Strength Indicator */}
            {formData.newPassword && (
              <PasswordStrengthIndicator 
                validation={validation}
              />
            )}

            {/* Original Password Requirements kept for backwards compatibility */}
            {formData.newPassword && false && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-sm">Password Requirements:</h4>
                <div className="space-y-2">
                  {validation.requirements.map((req, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      {req.met ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className={req.met ? "text-green-700" : "text-muted-foreground"}>
                        {req.label}
                      </span>
                    </div>
                  ))}
                </div>
                
                {/* Password Strength Indicator with zxcvbn feedback */}
                <div className="pt-2 space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">Strength:</span>
                    <span className={`text-sm font-semibold ${
                      validation.strength === 'strong' ? 'text-green-600' :
                      validation.strength === 'medium' ? 'text-amber-600' :
                      'text-red-600'
                    }`}>
                      {validation.strength.toUpperCase()} (Score: {validation.zxcvbnScore}/4)
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${
                        validation.strength === 'strong' ? 'bg-green-600 w-full' :
                        validation.strength === 'medium' ? 'bg-amber-600 w-2/3' :
                        'bg-red-600 w-1/3'
                      }`}
                    />
                  </div>
                  
                  {/* zxcvbn feedback with breach warnings */}
                  {validation.feedback && (
                    <div className={`flex items-start gap-2 p-3 rounded text-sm font-medium ${
                      validation.zxcvbnScore < 2 
                        ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900'
                        : 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                    }`}>
                      <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold mb-1">
                          {validation.zxcvbnScore < 2 ? '🚨 Security Warning' : '💡 Suggestion'}
                        </p>
                        <p className="text-xs">{validation.feedback}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Crack time estimate */}
                  {validation.crackTimeDisplay && validation.strength === 'strong' && (
                    <div className="text-xs text-muted-foreground">
                      Estimated crack time: <span className="font-semibold text-green-600">{validation.crackTimeDisplay}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Password Mismatch Warning */}
            {formData.confirmPassword && formData.newPassword !== formData.confirmPassword && (
              <Alert variant="destructive">
                <AlertDescription>
                  Passwords do not match. Please try again.
                </AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !validation.valid || formData.newPassword !== formData.confirmPassword}
            >
              {loading 
                ? (tokenMode ? "Setting Password..." : "Changing Password...") 
                : (tokenMode ? "SET PASSWORD" : "Change Password & Continue")
              }
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
