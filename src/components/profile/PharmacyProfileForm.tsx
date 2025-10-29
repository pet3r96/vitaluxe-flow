import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { GoogleAddressAutocomplete, AddressValue } from "@/components/ui/google-address-autocomplete";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { phoneSchema } from "@/lib/validators";
import { Loader2 } from "lucide-react";

const pharmacyFormSchema = z.object({
  name: z.string().min(1, "Pharmacy name is required"),
  contact_email: z.string().email("Invalid email"),
  phone: phoneSchema,
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    formatted: z.string().optional(),
  }),
});

type PharmacyFormValues = z.infer<typeof pharmacyFormSchema>;

export function PharmacyProfileForm() {
  const { effectiveUserId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<PharmacyFormValues>({
    resolver: zodResolver(pharmacyFormSchema),
    defaultValues: {
      name: "",
      contact_email: "",
      phone: "",
      address: {
        street: "",
        city: "",
        state: "",
        zip: "",
        formatted: "",
      },
    },
  });

  // Query pharmacy data
  const { data: pharmacy, isLoading } = useQuery({
    queryKey: ["pharmacy-profile", effectiveUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharmacies")
        .select("*")
        .eq("user_id", effectiveUserId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!effectiveUserId,
  });

  // Update form when data loads
  useEffect(() => {
    if (pharmacy) {
      form.reset({
        name: pharmacy.name || "",
        contact_email: pharmacy.contact_email || "",
        phone: pharmacy.phone || "",
        address: {
          street: pharmacy.address_street || "",
          city: pharmacy.address_city || "",
          state: pharmacy.address_state || "",
          zip: pharmacy.address_zip || "",
          formatted: pharmacy.address_formatted || "",
        },
      });
    }
  }, [pharmacy, form]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (values: PharmacyFormValues) => {
      const { error } = await supabase
        .from("pharmacies")
        .update({
          name: values.name,
          phone: values.phone,
          address_street: values.address.street,
          address_city: values.address.city,
          address_state: values.address.state,
          address_zip: values.address.zip,
          address_formatted: values.address.formatted,
        })
        .eq("user_id", effectiveUserId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pharmacy-profile"] });
      toast({
        title: "Success",
        description: "Pharmacy profile updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update pharmacy profile",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: PharmacyFormValues) => {
    updateMutation.mutate(values);
  };

  const handlePasswordReset = async () => {
    if (!pharmacy?.contact_email) return;

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(pharmacy.contact_email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast({
        title: "Password Reset Email Sent",
        description: "Check your email for the password reset link",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send password reset email",
        variant: "destructive",
      });
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
          <CardTitle>Pharmacy Information</CardTitle>
          <CardDescription>
            Manage your pharmacy details and contact information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pharmacy Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter pharmacy name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Email</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="contact@pharmacy.com" 
                        {...field} 
                        disabled 
                        className="bg-muted"
                      />
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
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="(555) 555-5555"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <GoogleAddressAutocomplete
                        value={{
                          street: field.value.street || "",
                          city: field.value.city || "",
                          state: field.value.state || "",
                          zip: field.value.zip || "",
                          formatted: field.value.formatted || "",
                        }}
                        onChange={(address: AddressValue) => {
                          field.onChange({
                            street: address.street,
                            city: address.city,
                            state: address.state,
                            zip: address.zip,
                            formatted: address.formatted,
                          });
                        }}
                        placeholder="Enter pharmacy address"
                      />
                    </FormControl>
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
                  "Save Changes"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Security</CardTitle>
          <CardDescription>
            Manage your password and account security settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handlePasswordReset}
            variant="outline"
            className="w-full sm:w-auto"
          >
            Reset Password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
