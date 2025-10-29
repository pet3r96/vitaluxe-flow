import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Mail, Lock, Bell, CheckCircle2 } from "lucide-react";
import { ChangePasswordDialog } from "@/components/patient/ChangePasswordDialog";
import { NotificationPreferencesDialog } from "@/components/notifications/NotificationPreferencesDialog";
import { ActivityLogSection } from "@/components/patient/ActivityLogSection";
import { PhoneInput } from "@/components/ui/phone-input";
import { GoogleAddressAutocomplete, AddressValue } from "@/components/ui/google-address-autocomplete";
import { validatePhone } from "@/lib/validators";

export default function PatientProfile() {
  const { effectiveUserId } = useAuth();
  const [editing, setEditing] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showNotificationsDialog, setShowNotificationsDialog] = useState(false);
  const [phone, setPhone] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [addressValue, setAddressValue] = useState<AddressValue>({});

  const { data: profile, refetch, isLoading, error } = useQuery({
    queryKey: ["patient-profile", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("patient_accounts")
        .select("*")
        .eq("user_id", effectiveUserId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Initialize state from profile data
  useEffect(() => {
    if (profile) {
      setPhone(profile.phone ? profile.phone.replace(/\D/g, "") : "");
      setEmergencyPhone(profile.emergency_contact_phone ? profile.emergency_contact_phone.replace(/\D/g, "") : "");
      
      // Initialize address value from profile
      if (profile.address) {
        setAddressValue({
          street: profile.address || "",
          city: profile.city || "",
          state: profile.state || "",
          zip: profile.zip_code || "",
          formatted: profile.address ? 
            `${profile.address}${profile.city ? ', ' + profile.city : ''}${profile.state ? ', ' + profile.state : ''}${profile.zip_code ? ' ' + profile.zip_code : ''}` 
            : "",
          status: "verified",
          source: "manual"
        });
      }
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      if (!effectiveUserId) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("patient_accounts")
        .update(updates)
        .eq("user_id", effectiveUserId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated successfully");
      setEditing(false);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // Validate phone numbers before submission
    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.valid) {
      toast.error(phoneValidation.error || "Invalid phone number");
      return;
    }

    // Validate emergency contact phone if provided
    if (emergencyPhone && emergencyPhone !== "") {
      const emergencyPhoneValidation = validatePhone(emergencyPhone);
      if (!emergencyPhoneValidation.valid) {
        toast.error("Invalid emergency contact phone: " + emergencyPhoneValidation.error);
        return;
      }
    }

    // Validate address if changed
    if (addressValue.street && addressValue.status !== "verified") {
      toast.error("Please select a valid address from the suggestions");
      return;
    }

    updateMutation.mutate({
      first_name: formData.get("first_name"),
      last_name: formData.get("last_name"),
      phone: phone,
      date_of_birth: formData.get("date_of_birth"),
      address: addressValue.street || "",
      city: addressValue.city || "",
      state: addressValue.state || "",
      zip_code: addressValue.zip || "",
      emergency_contact_name: formData.get("emergency_contact_name"),
      emergency_contact_phone: emergencyPhone,
    });
  };

  const hasIncompleteProfile = profile && (!profile.first_name || !profile.last_name || !profile.date_of_birth || !profile.address);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-4xl py-8">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">
              Error loading profile: {error.message}
            </p>
            <Button onClick={() => refetch()} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container max-w-4xl py-8">
        <Card className="border-warning">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <p className="text-lg font-semibold">Profile Not Found</p>
              <p className="text-muted-foreground">
                Your patient profile hasn't been created yet. Please contact your practice to set up your account.
              </p>
              <Button onClick={() => refetch()}>
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Incomplete Warning */}
      {hasIncompleteProfile && (
        <Card className="border-warning bg-warning/10">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-warning-foreground">
              Your profile is incomplete. Please fill in all required information to ensure proper access to services.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Email Section (Read-only) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Address
          </CardTitle>
          <CardDescription>Your account email address</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm font-medium">{profile?.email || "Email not available"}</p>
            <p className="text-xs text-muted-foreground">
              Email cannot be changed. Contact support if you need assistance.
            </p>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} key={profile?.id}>
        <div className="grid gap-6">
          {/* Personal Information Section */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Your basic details</CardDescription>
                </div>
                {!editing && (
                  <Button onClick={() => setEditing(true)} size="sm" type="button">
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    name="first_name"
                    defaultValue={profile?.first_name || ''}
                    placeholder="Enter your first name"
                    disabled={!editing}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    name="last_name"
                    defaultValue={profile?.last_name || ''}
                    placeholder="Enter your last name"
                    disabled={!editing}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="date_of_birth">Date of Birth</Label>
                  <Input
                    id="date_of_birth"
                    name="date_of_birth"
                    type="date"
                    defaultValue={profile?.date_of_birth || ''}
                    placeholder="YYYY-MM-DD"
                    disabled={!editing}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <PhoneInput
                    id="phone"
                    name="phone"
                    value={phone}
                    onChange={setPhone}
                    disabled={!editing}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Address Section */}
          <Card>
            <CardHeader>
              <CardTitle>Address</CardTitle>
              <CardDescription>Your mailing address - validated with Google</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <GoogleAddressAutocomplete
                value={addressValue}
                onChange={setAddressValue}
                label="Street Address"
                disabled={!editing}
                placeholder="Start typing your address..."
              />

              {addressValue.street && (
                <div className="grid gap-4 md:grid-cols-3 pt-2">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">City</Label>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{addressValue.city || "-"}</p>
                      {addressValue.status === "verified" && (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">State</Label>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{addressValue.state || "-"}</p>
                      {addressValue.status === "verified" && (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">ZIP Code</Label>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{addressValue.zip || "-"}</p>
                      {addressValue.status === "verified" && (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Emergency Contact Section */}
          <Card>
            <CardHeader>
              <CardTitle>Emergency Contact</CardTitle>
              <CardDescription>In case of emergency</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="emergency_contact_name">Contact Name</Label>
                  <Input
                    id="emergency_contact_name"
                    name="emergency_contact_name"
                    defaultValue={profile?.emergency_contact_name || ''}
                    placeholder="Emergency contact name"
                    disabled={!editing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergency_contact_phone">Contact Phone</Label>
                  <PhoneInput
                    id="emergency_contact_phone"
                    name="emergency_contact_phone"
                    value={emergencyPhone}
                    onChange={setEmergencyPhone}
                    disabled={!editing}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {editing && (
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  refetch();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </div>
          )}
        </div>
      </form>

      {/* Security Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Security
          </CardTitle>
          <CardDescription>Manage your password and account security</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setShowPasswordDialog(true)} variant="outline">
            <Lock className="mr-2 h-4 w-4" />
            Change Password
          </Button>
        </CardContent>
      </Card>

      {/* Notification Preferences Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>Manage your email and SMS notification settings</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setShowNotificationsDialog(true)} variant="outline">
            <Bell className="mr-2 h-4 w-4" />
            Manage Notifications
          </Button>
        </CardContent>
      </Card>

      {/* Account Activity Section */}
      <ActivityLogSection />

      {/* Dialogs */}
      <ChangePasswordDialog 
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
      />
      <NotificationPreferencesDialog
        open={showNotificationsDialog}
        onOpenChange={setShowNotificationsDialog}
      />
    </div>
  );
}
