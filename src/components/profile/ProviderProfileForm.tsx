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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, KeyRound, Building2, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { phoneSchema, npiSchema, deaSchema } from "@/lib/validators";
import { sanitizeEncrypted } from "@/lib/utils";
import { PhoneInput } from "@/components/ui/phone-input";

const providerFormSchema = z.object({
  full_name: z.string().min(1, "Full name is required").max(100),
  email: z.string().email("Invalid email address"),
  phone: phoneSchema,
  npi: npiSchema,
  dea: deaSchema,
  license_number: z.string().optional(),
});

type ProviderFormValues = z.infer<typeof providerFormSchema>;

export const ProviderProfileForm = () => {
  const { effectiveUserId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [npiVerificationStatus, setNpiVerificationStatus] = useState<
    null | "verifying" | "verified" | "failed"
  >(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["provider-profile", effectiveUserId],
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

  // Fetch practice information for this provider
  const { data: practiceInfo } = useQuery({
    queryKey: ["provider-practice-info", effectiveUserId],
    queryFn: async () => {
      // Get provider record
      const { data: providerData, error: providerError } = await supabase
        .from("providers")
        .select("practice_id")
        .eq("user_id", effectiveUserId)
        .single();
      
      if (providerError || !providerData?.practice_id) return null;
      
      // Get practice profile
      const { data: practiceData, error: practiceError } = await supabase
        .from("profiles")
        .select("name, address_street, address_city, address_state, address_zip")
        .eq("id", providerData.practice_id)
        .single();
      
      if (practiceError) throw practiceError;
      return practiceData;
    },
    enabled: !!effectiveUserId,
  });


  const [originalNpi, setOriginalNpi] = useState("");

  const form = useForm<ProviderFormValues>({
    resolver: zodResolver(providerFormSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      npi: "",
      dea: "",
      license_number: "",
    },
  });

  // Load decrypted credentials when profile loads
  useEffect(() => {
    const loadDecryptedCredentials = async () => {
      if (!effectiveUserId) return;
      
      try {
        console.log('[ProviderProfileForm] Loading credentials for user:', effectiveUserId);
        
        // Try RPC first
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_decrypted_profile_credentials', {
          p_user_id: effectiveUserId
        });

        if (rpcError) {
          console.error('[ProviderProfileForm] RPC error, falling back to plaintext:', rpcError);
        }

        const creds = rpcData?.[0];
        console.log('[ProviderProfileForm] RPC returned:', !!creds);
        
        // Helper to get display name
        const getDisplayName = () => {
          if (creds?.full_name) return creds.full_name;
          if (profile?.full_name) return profile.full_name;
          if (profile?.name && !profile.name.includes('@')) return profile.name;
          return "";
        };
        
        const npiValue = creds?.npi || profile?.npi || "";
        
        if (creds || profile) {
          form.reset({
            full_name: getDisplayName(),
            email: profile?.email || "",
            phone: (creds?.phone || profile?.phone || "").replace(/\D/g, ''),
            npi: npiValue,
            dea: creds?.dea || profile?.dea || "",
            license_number: creds?.license_number || profile?.license_number || "",
          });
          setOriginalNpi(npiValue);
          
          if (!creds && !rpcError) {
            console.log('[ProviderProfileForm] No RPC data, used plaintext fallback');
          }
        }
      } catch (error) {
        console.error('[ProviderProfileForm] Error loading decrypted credentials:', error);
        // Ultimate fallback
        const getDisplayName = () => {
          if (profile?.full_name) return profile.full_name;
          if (profile?.name && !profile.name.includes('@')) return profile.name;
          return "";
        };
        
        const npiValue = profile?.npi || "";
        form.reset({
          full_name: getDisplayName(),
          email: profile?.email || "",
          phone: (profile?.phone || "").replace(/\D/g, ""),
          npi: npiValue,
          dea: profile?.dea || "",
          license_number: profile?.license_number || "",
        });
        setOriginalNpi(npiValue);
      }
    };

    loadDecryptedCredentials();
  }, [profile, form, effectiveUserId]);

  const updateMutation = useMutation({
    mutationFn: async (values: ProviderFormValues) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: values.full_name,
          email: values.email,
          phone: values.phone,
          npi: values.npi,
          dea: values.dea,
          license_number: values.license_number,
        })
        .eq("id", effectiveUserId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your provider information has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["provider-profile"] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: ProviderFormValues) => {
    // Check NPI verification only if NPI changed
    const npiChanged = values.npi !== originalNpi;
    if (npiChanged && npiVerificationStatus !== "verified") {
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
      <Card>
      <CardHeader>
        <CardTitle>Provider Profile</CardTitle>
        <CardDescription>
          Manage your professional credentials and contact information
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Dr. Sarah Johnson" {...field} />
                  </FormControl>
                  <FormDescription>
                    Your full name as it appears on your medical license
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input placeholder="doctor@example.com" {...field} disabled />
                  </FormControl>
                  <FormDescription>
                    Your professional email address
                  </FormDescription>
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
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="(555) 123-4567"
                    />
                  </FormControl>
                  <FormDescription>
                    Your direct contact number (10 digits)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="npi"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provider NPI Number</FormLabel>
                  <FormControl>
                    <Input 
                      type="tel"
                      placeholder="1234567890" 
                      maxLength={10}
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        field.onChange(value);
                        
                        // Reset verification status when NPI changes
                        if (value.length !== 10) {
                          setNpiVerificationStatus(null);
                        } else {
                          setNpiVerificationStatus("verifying");
                        }
                        
                        // Real-time NPI verification with timeout handling
                        if (value && value.length === 10) {
                          const expectedNpi = value; // Capture current value
verifyNPIDebounced(value, (result) => {
                             // Only apply result if NPI still matches expected value
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
                                 // Failed or has error
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
                    <p className="text-sm text-muted-foreground">🔄 Verifying NPI...</p>
                  )}
                  {npiVerificationStatus === "verified" && (
                    <p className="text-sm text-green-600">✅ NPI Verified</p>
                  )}
                  {npiVerificationStatus === "failed" && (
                    <p className="text-sm text-destructive">❌ Invalid NPI</p>
                  )}
                  <FormDescription>
                    Your personal National Provider Identifier (verified against NPPES)
                  </FormDescription>
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
                  <FormDescription>
                    Your DEA registration (2 letters + 7 digits)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="license_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Medical License Number</FormLabel>
                  <FormControl>
                    <Input placeholder="ML-38383920" {...field} />
                  </FormControl>
                  <FormDescription>
                    Your state medical license number
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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
          </form>
        </Form>
      </CardContent>
    </Card>

    {/* Practice Shipping Address - Read Only */}
    {practiceInfo && practiceInfo.address_street && (
      <Card className="border-primary/20 bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Practice Shipping Address
          </CardTitle>
          <CardDescription>
            Orders will be shipped to this address when you select "Ship to My Practice"
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="font-medium">{practiceInfo.name}</div>
            <div className="text-muted-foreground">
              {practiceInfo.address_street}
            </div>
            <div className="text-muted-foreground">
              {practiceInfo.address_city}, {practiceInfo.address_state} {practiceInfo.address_zip}
            </div>
            <Badge variant="outline" className="mt-2 flex items-center gap-1 w-fit">
              <Info className="h-3 w-3" />
              This address is managed by your practice administrator
            </Badge>
          </div>
        </CardContent>
      </Card>
    )}

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
    </div>
  );
};
