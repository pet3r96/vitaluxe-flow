import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
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
import { Loader2, Save, KeyRound } from "lucide-react";
import { AddressInput } from "@/components/ui/address-input";
import { phoneSchema, npiSchema, deaSchema } from "@/lib/validators";
import { sanitizeEncrypted } from "@/lib/utils";

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
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export const PracticeProfileForm = () => {
  const { effectiveUserId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isResettingPassword, setIsResettingPassword] = useState(false);

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
    } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (values: ProfileFormValues & { 
      address?: any;
      shipping_address?: any;
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
    updateMutation.mutate(values);
  };

  const handleResetPassword = async () => {
    if (!profile?.email) return;
    
    setIsResettingPassword(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
        redirectTo: `${window.location.origin}/auth`,
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
      <Card className="p-4 sm:p-6">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-lg sm:text-xl">Practice Profile</CardTitle>
        <CardDescription className="text-sm">
          Manage your practice information and shipping preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Practice Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Smith Medical Practice" {...field} />
                  </FormControl>
                  <FormDescription>
                    Your practice or clinic name
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
                  <FormLabel>Contact Email</FormLabel>
                  <FormControl>
                    <Input placeholder="practice@example.com" {...field} />
                  </FormControl>
                  <FormDescription>
                    Primary contact email for your practice
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
                  <FormLabel>Practice Phone Number</FormLabel>
                  <FormControl>
                    <Input 
                      type="tel"
                      placeholder="1234567890" 
                      maxLength={10}
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        field.onChange(value);
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Main phone number for your practice (10 digits)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <AddressInput
                      label="Practice Address"
                      value={field.value || {}}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormDescription>
                    Physical location of your practice
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
                  <FormLabel>Practice NPI Number</FormLabel>
                  <FormControl>
                    <Input 
                      type="tel"
                      placeholder="1234567890" 
                      maxLength={10}
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        field.onChange(value);
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Your practice's National Provider Identifier (10 digits)
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
                  <FormLabel>Practice DEA Number</FormLabel>
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
                    Practice DEA registration (2 letters + 7 digits)
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
                  <FormLabel>Practice License Number</FormLabel>
                  <FormControl>
                    <Input placeholder="MED123456" {...field} />
                  </FormControl>
                  <FormDescription>
                    Your practice or business license number
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="shipping_address"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <AddressInput
                      label="Practice Shipping Address"
                      value={field.value || {}}
                      onChange={field.onChange}
                    />
                  </FormControl>
            <FormDescription>
              This address will be used when you order for your practice/med spa
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <Button
              type="submit" 
              disabled={updateMutation.isPending}
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

    <Card className="p-4 sm:p-6">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-lg sm:text-xl">Account Security</CardTitle>
        <CardDescription className="text-sm">
          Manage your password and account security settings
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
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