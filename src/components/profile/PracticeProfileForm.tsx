import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { verifyNPIDebounced } from "@/lib/npiVerification";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, KeyRound, Info, Bell } from "lucide-react";
import { NotificationPreferencesDialog } from "@/components/notifications/NotificationPreferencesDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { GoogleAddressAutocomplete, type AddressValue } from "@/components/ui/google-address-autocomplete";
import { PhoneInput } from "@/components/ui/phone-input";
import { phoneSchema, npiSchema, deaSchema } from "@/lib/validators";
import { sanitizeEncrypted } from "@/lib/utils";
import { SignedAgreementSection } from "./SignedAgreementSection";

const profileFormSchema = z.object({
  name: z.string().min(1, "Practice name is required").max(100),
  email: z.string().email("Invalid email address"),
  phone: phoneSchema,
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
  }).optional(),
  npi: npiSchema,
  dea: deaSchema,
  license_number: z.string().optional(),
  shipping_address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
  }).optional(),
  billing_address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
  }).optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export const PracticeProfileForm = () => {
  const { effectiveUserId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [npiVerificationStatus, setNpiVerificationStatus] = useState<
    null | "verifying" | "verified" | "failed"
  >(null);
  const [showNotificationsDialog, setShowNotificationsDialog] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["practice-profile", effectiveUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", effectiveUserId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!effectiveUserId,
  });


  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    values: profile ? {
      name: profile.name || "",
      email: sanitizeEncrypted(profile.email) || "",
      phone: sanitizeEncrypted(profile.phone) || "",
      address: {
        street: profile.address_street || "",
        city: profile.address_city || "",
        state: profile.address_state || "",
        zip: profile.address_zip || "",
      },
      npi: sanitizeEncrypted(profile.npi) || "",
      dea: sanitizeEncrypted(profile.dea) || "",
      license_number: sanitizeEncrypted(profile.license_number) || "",
      shipping_address: {
        street: profile.shipping_address_street || "",
        city: profile.shipping_address_city || "",
        state: profile.shipping_address_state || "",
        zip: profile.shipping_address_zip || "",
      },
      billing_address: {
        street: profile.billing_street || "",
        city: profile.billing_city || "",
        state: profile.billing_state || "",
        zip: profile.billing_zip || "",
      },
    } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (values: ProfileFormValues & { 
      address?: any;
      shipping_address?: any;
      billing_address?: any;
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: values.name,
          email: values.email,
          phone: values.phone,
          address_street: values.address?.street,
          address_city: values.address?.city,
          address_state: values.address?.state,
          address_zip: values.address?.zip,
          address_formatted: values.address?.formatted,
          address_verification_status: values.address?.status || 'unverified',
          address_verified_at: values.address?.verified_at,
          address_verification_source: values.address?.source,
          npi: values.npi,
          dea: values.dea,
          license_number: values.license_number,
          shipping_address_street: values.shipping_address?.street,
          shipping_address_city: values.shipping_address?.city,
          shipping_address_state: values.shipping_address?.state,
          shipping_address_zip: values.shipping_address?.zip,
          shipping_address_formatted: values.shipping_address?.formatted,
          shipping_address_verification_status: values.shipping_address?.status || 'unverified',
          shipping_address_verified_at: values.shipping_address?.verified_at,
          shipping_address_verification_source: values.shipping_address?.source,
          billing_street: values.billing_address?.street,
          billing_city: values.billing_address?.city,
          billing_state: values.billing_address?.state,
          billing_zip: values.billing_address?.zip,
        })
        .eq("id", effectiveUserId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile information has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["practice-profile"] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: ProfileFormValues) => {
    // Check NPI verification status
    if (npiVerificationStatus !== "verified") {
      if (npiVerificationStatus === "verifying") {
        toast({
          title: "Please wait",
          description: "NPI verification is in progress",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Verification Required",
          description: "NPI must be verified before saving",
          variant: "destructive",
        });
      }
      return;
    }

    updateMutation.mutate(values);
  };

  const handleResetPassword = async () => {
    if (!profile?.email) return;
    
    setIsResettingPassword(true);
    try {
      const { error } = await supabase.functions.invoke('send-password-reset-email', {
        body: { email: profile.email },
      });

      if (error) throw error;

      toast({
        title: "Password reset email sent",
        description: "Check your email for instructions to reset your password.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send password reset email",
        variant: "destructive",
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Card 1: Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Essential practice details and credentials
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
            {/* Practice Name - Full Width */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Practice Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Smith Medical Practice" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 2-Column Grid for Contact Info and Credentials */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Contact Information */}
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Email</FormLabel>
                      <FormControl>
                        <Input placeholder="practice@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <PhoneInput
                          value={field.value || ""}
                          onChange={field.onChange}
                          placeholder="(555) 123-4567"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Right Column: Credentials */}
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="npi"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NPI Number</FormLabel>
                      <FormControl>
                        <Input 
                          type="tel"
                          placeholder="1234567890" 
                          maxLength={10}
                          {...field}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '');
                            field.onChange(value);
                            
                            if (value.length !== 10) {
                              setNpiVerificationStatus(null);
                            } else {
                              setNpiVerificationStatus("verifying");
                            }
                            
                            if (value && value.length === 10) {
                              const expectedNpi = value;
                              verifyNPIDebounced(value, (result) => {
                                if (form.getValues('npi') === expectedNpi) {
                                  if (result.valid && !result.error) {
                                    setNpiVerificationStatus("verified");
                                    if (result.providerName) {
                                      toast({
                                        title: "NPI Verified ✓",
                                        description: `${result.providerName}${result.specialty ? ` - ${result.specialty}` : ''}`,
                                      });
                                    } else {
                                      toast({
                                        title: "NPI Verified ✓",
                                        description: `NPI ${result.npi} verified successfully${result.type ? ` (${result.type})` : ''}`,
                                      });
                                    }
                                  } else {
                                    setNpiVerificationStatus("failed");
                                    toast({
                                      title: "Invalid NPI",
                                      description: result.error || "NPI verification failed",
                                      variant: "destructive",
                                    });
                                  }
                                }
                              });
                            }
                          }}
                        />
                      </FormControl>
                      {npiVerificationStatus === "verifying" && (
                        <p className="text-sm text-muted-foreground">🔄 Verifying...</p>
                      )}
                      {npiVerificationStatus === "verified" && (
                        <p className="text-sm text-green-600">✅ Verified</p>
                      )}
                      {npiVerificationStatus === "failed" && (
                        <p className="text-sm text-destructive">❌ Invalid</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dea"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>DEA Number</FormLabel>
                      <FormControl>
                        <Input 
                          type="text"
                          placeholder="AB1234567" 
                          maxLength={9}
                          {...field}
                          onChange={(e) => {
                            let value = e.target.value.toUpperCase();
                            value = value.replace(/[^A-Z0-9]/g, '');
                            if (value.length <= 2) {
                              value = value.replace(/[^A-Z]/g, '');
                            } else {
                              const letters = value.slice(0, 2).replace(/[^A-Z]/g, '');
                              const digits = value.slice(2).replace(/\D/g, '');
                              value = letters + digits;
                            }
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="license_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>License Number</FormLabel>
                      <FormControl>
                        <Input placeholder="MED123456" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Addresses */}
        <Card>
          <CardHeader>
            <CardTitle>Addresses</CardTitle>
            <CardDescription>
              Manage practice location, shipping, and billing addresses
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Practice Address */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Practice Address</h3>
                <p className="text-sm text-muted-foreground">Physical location of your practice</p>
              </div>
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <GoogleAddressAutocomplete
                        value={field.value || {}}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Divider */}
            <div className="border-t" />

            {/* Shipping Address */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">Shipping Address</h3>
                  <p className="text-sm text-muted-foreground">Where products will be delivered</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const practiceAddr = form.getValues('address');
                    if (practiceAddr) {
                      form.setValue('shipping_address', {
                        street: practiceAddr.street,
                        city: practiceAddr.city,
                        state: practiceAddr.state,
                        zip: practiceAddr.zip,
                      });
                    }
                  }}
                >
                  Copy from Practice
                </Button>
              </div>
              <FormField
                control={form.control}
                name="shipping_address"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <GoogleAddressAutocomplete
                        value={field.value || {}}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Divider */}
            <div className="border-t" />

            {/* Billing Address */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">Billing Address</h3>
                  <p className="text-sm text-muted-foreground">Default billing address for payments</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const shippingAddr = form.getValues('shipping_address');
                    if (shippingAddr) {
                      form.setValue('billing_address', {
                        street: shippingAddr.street,
                        city: shippingAddr.city,
                        state: shippingAddr.state,
                        zip: shippingAddr.zip,
                      });
                    }
                  }}
                >
                  Copy from Shipping
                </Button>
              </div>
              <FormField
                control={form.control}
                name="billing_address"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <GoogleAddressAutocomplete
                        value={field.value || {}}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            type="submit" 
            disabled={updateMutation.isPending || npiVerificationStatus !== "verified"}
            className="w-full sm:w-auto"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Profile
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>

    {/* Card 3: Account Security */}
    <Card>
      <CardHeader>
        <CardTitle>Account Security</CardTitle>
        <CardDescription>
          Manage your password and account security settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          onClick={handleResetPassword}
          disabled={isResettingPassword}
        >
          {isResettingPassword ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <KeyRound className="mr-2 h-4 w-4" />
          )}
          Reset Password
        </Button>
      </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Manage your email and SMS notification settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => setShowNotificationsDialog(true)} 
            variant="outline"
          >
            <Bell className="mr-2 h-4 w-4" />
            Manage Notifications
          </Button>
        </CardContent>
      </Card>
    
    <SignedAgreementSection userId={effectiveUserId} />

    <NotificationPreferencesDialog
      open={showNotificationsDialog}
      onOpenChange={setShowNotificationsDialog}
    />
    </div>
  );
};