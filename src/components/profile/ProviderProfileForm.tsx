import { useState } from "react";
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
import { Loader2, Save } from "lucide-react";
import { AddressInput } from "@/components/ui/address-input";

const profileFormSchema = z.object({
  name: z.string().min(1, "Full name is required").max(100),
  phone: z.string().optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
  }).optional(),
  npi: z.string().optional(),
  dea: z.string().optional(),
  license_number: z.string().optional(),
  shipping_address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
  }).optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export const ProviderProfileForm = () => {
  const { effectiveUserId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    values: profile ? {
      name: profile.name || "",
      phone: profile.phone || "",
      address: {
        street: profile.address_street || "",
        city: profile.address_city || "",
        state: profile.address_state || "",
        zip: profile.address_zip || "",
      },
      npi: profile.npi || "",
      dea: profile.dea || "",
      license_number: profile.license_number || "",
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

  const onSubmit = (values: ProfileFormValues) => {
    updateMutation.mutate(values);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Profile</CardTitle>
        <CardDescription>
          Manage your professional information and shipping preferences
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
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Dr. John Smith" {...field} />
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
                    <Input placeholder="(555) 123-4567" {...field} />
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
                  <FormControl>
                    <AddressInput
                      label="Primary Address"
                      value={field.value || {}}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="npi"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>NPI Number</FormLabel>
                  <FormControl>
                    <Input placeholder="1234567890" {...field} />
                  </FormControl>
                  <FormDescription>
                    Your National Provider Identifier
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
                    <Input placeholder="AB1234567" {...field} />
                  </FormControl>
                  <FormDescription>
                    Your Drug Enforcement Administration number
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
                  <FormLabel>License Number</FormLabel>
                  <FormControl>
                    <Input placeholder="MED123456" {...field} />
                  </FormControl>
                  <FormDescription>
                    Your medical license number
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
  );
};