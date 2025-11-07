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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, KeyRound, Bell } from "lucide-react";
import { PhoneInput } from "@/components/ui/phone-input";
import { NotificationPreferencesDialog } from "@/components/notifications/NotificationPreferencesDialog";
import { phoneSchema } from "@/lib/validators";
import { SignedAgreementSection } from "./SignedAgreementSection";

const staffFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  phone: phoneSchema.optional(),
});

type StaffFormValues = z.infer<typeof staffFormSchema>;

export const StaffProfileForm = () => {
  const { effectiveUserId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [showNotificationsDialog, setShowNotificationsDialog] = useState(false);

  const { data: staffData, isLoading } = useQuery({
    queryKey: ["staff-profile", effectiveUserId],
    queryFn: async () => {
      // Get staff data with practice relationship
      const { data: practiceStaffData, error: staffError } = await supabase
        .from("practice_staff")
        .select(`
          *,
          practice:profiles!practice_staff_practice_id_fkey(name)
        `)
        .eq("user_id", effectiveUserId)
        .single();

      if (staffError) throw staffError;

      // Get profile data
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", effectiveUserId)
        .single();

      if (profileError) throw profileError;

      return {
        ...profileData,
        practiceName: practiceStaffData?.practice?.name || "Unknown Practice",
      };
    },
    enabled: !!effectiveUserId,
  });

  const form = useForm<StaffFormValues>({
    resolver: zodResolver(staffFormSchema),
    values: staffData ? {
      name: staffData.name || "",
      email: staffData.email || "",
      phone: staffData.phone ? staffData.phone.replace(/\D/g, "") : "",
    } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (values: StaffFormValues) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: values.name,
          phone: values.phone || null,
        })
        .eq("id", effectiveUserId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile information has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["staff-profile"] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: StaffFormValues) => {
    updateMutation.mutate(values);
  };

  const handleResetPassword = async () => {
    if (!staffData?.email) return;
    
    setIsResettingPassword(true);
    try {
      const { error } = await supabase.functions.invoke('send-password-reset-email', {
        body: { email: staffData.email },
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
          <CardTitle className="text-lg sm:text-xl">Staff Profile</CardTitle>
          <CardDescription className="text-sm">
            Manage your contact information and account settings
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <FormLabel>Practice</FormLabel>
                <Input 
                  value={staffData?.practiceName || ""} 
                  disabled 
                  className="bg-muted"
                />
                <FormDescription>
                  The practice you work for
                </FormDescription>
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormDescription>
                      Your first and last name
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
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="staff@example.com" 
                        {...field} 
                        disabled 
                        className="bg-muted"
                      />
                    </FormControl>
                    <FormDescription>
                      Your email address (cannot be changed)
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
                    <FormLabel>Phone Number (Optional)</FormLabel>
                    <FormControl>
                      <PhoneInput
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="(555) 123-4567"
                      />
                    </FormControl>
                    <FormDescription>
                      Your contact phone number (10 digits)
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

      <Card className="p-4 sm:p-6">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription className="text-sm">
            Manage your email and SMS notification settings
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
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
