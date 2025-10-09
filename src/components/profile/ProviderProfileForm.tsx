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

const profileFormSchema = z.object({
  name: z.string().min(1, "Full name is required").max(100),
  phone: z.string().optional(),
  address: z.string().optional(),
  npi: z.string().optional(),
  shipping_address: z.string().optional(),
  shipping_preference: z.enum(["office", "patient_drop"], {
    required_error: "Please select a shipping preference",
  }),
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
      address: profile.address || "",
      npi: profile.npi || "",
      shipping_address: profile.shipping_address || "",
      shipping_preference: (profile.shipping_preference as "office" | "patient_drop") || "patient_drop",
    } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: values.name,
          phone: values.phone,
          address: values.address,
          npi: values.npi,
          shipping_address: values.shipping_address,
          shipping_preference: values.shipping_preference,
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
                  <FormLabel>Primary Address</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="123 Main St, City, State, ZIP" 
                      {...field} 
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
              name="shipping_address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Practice Shipping Address</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Practice address for direct shipments" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    This address will be used when you order for your practice/med spa
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="shipping_preference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Shipping Preference</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select shipping preference" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="patient_drop">Ship to Patient</SelectItem>
                      <SelectItem value="office">Ship to Practice/Office</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose where orders should be shipped by default
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