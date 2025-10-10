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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save } from "lucide-react";

const providerFormSchema = z.object({
  full_name: z.string().min(1, "Full name is required").max(100),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  npi: z.string().optional(),
  dea: z.string().optional(),
  license_number: z.string().optional(),
});

type ProviderFormValues = z.infer<typeof providerFormSchema>;

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

  const form = useForm<ProviderFormValues>({
    resolver: zodResolver(providerFormSchema),
    values: profile ? {
      full_name: profile.full_name || "",
      email: profile.email || "",
      phone: profile.phone || "",
      npi: profile.npi || "",
      dea: profile.dea || "",
      license_number: profile.license_number || "",
    } : undefined,
  });

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
                    <Input placeholder="(555) 123-4567" {...field} />
                  </FormControl>
                  <FormDescription>
                    Your direct contact number
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
                    <Input placeholder="1234567890" {...field} />
                  </FormControl>
                  <FormDescription>
                    Your personal National Provider Identifier
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
                    <Input placeholder="BJ1234567" {...field} />
                  </FormControl>
                  <FormDescription>
                    Your Drug Enforcement Administration registration number
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
