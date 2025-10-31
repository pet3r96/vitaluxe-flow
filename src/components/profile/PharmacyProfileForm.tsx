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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

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
  states_serviced: z.array(z.string()).min(1, "Select at least one state where you are licensed"),
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
      states_serviced: [],
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
        phone: pharmacy.phone ? pharmacy.phone.replace(/\D/g, "") : "",
        address: {
          street: pharmacy.address_street || "",
          city: pharmacy.address_city || "",
          state: pharmacy.address_state || "",
          zip: pharmacy.address_zip || "",
          formatted: pharmacy.address_formatted || "",
        },
        states_serviced: pharmacy.states_serviced || [],
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
          states_serviced: values.states_serviced,
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

  const handleStateToggle = (state: string) => {
    const currentStates = form.getValues("states_serviced");
    if (currentStates.includes(state)) {
      form.setValue(
        "states_serviced",
        currentStates.filter((s) => s !== state)
      );
    } else {
      form.setValue("states_serviced", [...currentStates, state]);
    }
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
      {pharmacy && (
        <div className="patient-card p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-2xl font-bold gold-text-gradient">
                  {pharmacy.name?.charAt(0)?.toUpperCase() || 'P'}
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-foreground mb-1">
                {pharmacy.name}
              </h2>
              <p className="text-sm text-muted-foreground mb-2">
                {pharmacy.contact_email}
              </p>
              {pharmacy.states_serviced && pharmacy.states_serviced.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  <span className="text-xs text-muted-foreground mr-2">Licensed in:</span>
                  {pharmacy.states_serviced.slice(0, 10).map((state: string) => (
                    <Badge key={state} variant="outline" className="text-xs">
                      {state}
                    </Badge>
                  ))}
                  {pharmacy.states_serviced.length > 10 && (
                    <Badge variant="outline" className="text-xs">
                      +{pharmacy.states_serviced.length - 10} more
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="patient-card">
        <div className="p-6 border-b border-border">
          <h3 className="text-xl font-semibold">Pharmacy Information</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your pharmacy details and contact information
          </p>
        </div>
        <div className="p-6">
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
                className="w-full sm:w-auto touch-target"
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
        </div>
      </div>

      <div className="patient-card">
        <div className="p-6 border-b border-border">
          <h3 className="text-xl font-semibold">Licensed States</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Select all states where your pharmacy is licensed to operate
          </p>
        </div>
        <div className="p-6">
          <Form {...form}>
            <FormField
              control={form.control}
              name="states_serviced"
              render={({ field }) => (
                <FormItem>
                  <div className="space-y-4">
                    {/* Selected States Display */}
                    {field.value && field.value.length > 0 && (
                      <div className="space-y-2">
                        <Label>Currently Licensed In:</Label>
                        <div className="flex flex-wrap gap-2">
                          {field.value.map((state) => (
                            <Badge key={state} variant="secondary" className="text-sm">
                              {state}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {field.value.length} state{field.value.length !== 1 ? 's' : ''} selected
                        </p>
                      </div>
                    )}

                    {/* State Selection Grid */}
                    <div className="space-y-2">
                      <Label>Select States:</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-4 border border-border rounded-md max-h-64 overflow-y-auto">
                        {US_STATES.map((state) => (
                          <div key={state} className="flex items-center space-x-2">
                            <Checkbox
                              id={`state-${state}`}
                              checked={field.value?.includes(state) || false}
                              onCheckedChange={() => handleStateToggle(state)}
                            />
                            <Label 
                              htmlFor={`state-${state}`} 
                              className="text-sm cursor-pointer font-normal"
                            >
                              {state}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Form>
          
          <Button 
            onClick={form.handleSubmit(onSubmit)}
            disabled={updateMutation.isPending}
            className="w-full sm:w-auto mt-4 touch-target"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Update Licensed States"
            )}
          </Button>
        </div>
      </div>

      <div className="patient-card">
        <div className="p-6 border-b border-border">
          <h3 className="text-xl font-semibold">Account Security</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your password and keep your pharmacy account secure
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border border-border rounded-lg">
            <div>
              <p className="font-medium">Password</p>
              <p className="text-sm text-muted-foreground">
                Reset your password to maintain account security
              </p>
            </div>
            <Button 
              onClick={handlePasswordReset}
              variant="outline"
              className="touch-target w-full sm:w-auto"
            >
              Reset Password
            </Button>
          </div>
          
          {pharmacy && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border border-border rounded-lg bg-muted/50">
              <div>
                <p className="font-medium">Account Email</p>
                <p className="text-sm text-muted-foreground">
                  {pharmacy.contact_email}
                </p>
              </div>
              <Badge variant="secondary">Active</Badge>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
