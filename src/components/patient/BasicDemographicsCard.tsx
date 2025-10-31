import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GoogleAddressAutocomplete, AddressValue } from "@/components/ui/google-address-autocomplete";
import { toast } from "sonner";
import { Loader2, User, Calendar, MapPin, Mail, CheckCircle2, Edit2 } from "lucide-react";
import { format, differenceInYears } from "date-fns";

interface BasicDemographicsCardProps {
  patientAccount: any;
  effectiveUserId: string;
}

export const BasicDemographicsCard = ({ patientAccount, effectiveUserId }: BasicDemographicsCardProps) => {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [addressValue, setAddressValue] = useState<AddressValue>({});
  const queryClient = useQueryClient();

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<string>("");

  // Initialize form state when dialog opens
  useEffect(() => {
    if (isEditDialogOpen && patientAccount) {
      setFirstName(patientAccount.first_name || "");
      setLastName(patientAccount.last_name || "");
      setDateOfBirth(patientAccount.date_of_birth || "");
      setGender(patientAccount.gender_at_birth || "");

      // Initialize address value
      if (patientAccount.address) {
        setAddressValue({
          street: patientAccount.address || "",
          city: patientAccount.city || "",
          state: patientAccount.state || "",
          zip: patientAccount.zip_code || "",
          formatted: patientAccount.address
            ? `${patientAccount.address}${patientAccount.city ? ", " + patientAccount.city : ""}${patientAccount.state ? ", " + patientAccount.state : ""}${patientAccount.zip_code ? " " + patientAccount.zip_code : ""}`
            : "",
          status: "verified",
          source: "manual",
        });
      }
    }
  }, [isEditDialogOpen, patientAccount]);

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase
        .from("patient_accounts")
        .update(updates)
        .eq("user_id", effectiveUserId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demographics updated successfully");
      setIsEditDialogOpen(false);
      // Invalidate both queries to sync dashboard and profile
      queryClient.invalidateQueries({ queryKey: ["patient-account-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["patient-profile", effectiveUserId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update demographics");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!firstName || !lastName || !dateOfBirth) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate address if changed
    if (addressValue.street && addressValue.status !== "verified") {
      toast.error("Please select a valid address from the suggestions");
      return;
    }

    updateMutation.mutate({
      first_name: firstName,
      last_name: lastName,
      date_of_birth: dateOfBirth,
      address: addressValue.street || "",
      city: addressValue.city || "",
      state: addressValue.state || "",
      zip_code: addressValue.zip || "",
      gender_at_birth: gender || null,
    });
  };

  // Format display values
  const fullName = patientAccount?.first_name && patientAccount?.last_name
    ? `${patientAccount.first_name} ${patientAccount.last_name}`
    : "Not provided";

  const formattedDOB = patientAccount?.date_of_birth
    ? format(new Date(patientAccount.date_of_birth), "MMM dd, yyyy")
    : "Not provided";

  const age = patientAccount?.date_of_birth
    ? differenceInYears(new Date(), new Date(patientAccount.date_of_birth))
    : null;

  const formattedAddress = patientAccount?.address
    ? `${patientAccount.address}${patientAccount.city ? ", " + patientAccount.city : ""}${patientAccount.state ? ", " + patientAccount.state : ""}${patientAccount.zip_code ? " " + patientAccount.zip_code : ""}`
    : "Not provided";

  return (
    <>
      <Card className="border-border/50 bg-gradient-to-br from-card to-card/50 shadow-lg hover:shadow-xl transition-all duration-300">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Basic Demographics
            </CardTitle>
            <Button onClick={() => setIsEditDialogOpen(true)} size="sm" variant="outline" className="gap-2">
              <Edit2 className="h-4 w-4" />
              Edit Details
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Full Name */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50">
              <User className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium mb-1">Full Name</p>
                <p className="text-sm font-semibold text-foreground truncate">{fullName}</p>
              </div>
            </div>

            {/* Date of Birth */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50">
              <Calendar className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium mb-1">Date of Birth</p>
                <p className="text-sm font-semibold text-foreground">
                  {formattedDOB}
                  {age !== null && <span className="text-xs text-muted-foreground ml-1">(Age {age})</span>}
                </p>
              </div>
            </div>

            {/* Address */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50">
              <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium mb-1">Address</p>
                <p className="text-sm font-medium text-foreground line-clamp-2">{formattedAddress}</p>
              </div>
            </div>
          </div>

          {/* Email - Read Only */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
            <Mail className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground font-medium mb-1">Email Address (Read-only)</p>
              <p className="text-sm font-medium text-foreground truncate">{patientAccount?.email || "Not available"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Edit Basic Demographics</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Personal Information</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">
                    First Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Enter first name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">
                    Last Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Enter last name"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">
                    Date of Birth <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger id="gender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="not_specified">Not Specified</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Address Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Address Information</h3>
              <GoogleAddressAutocomplete
                value={addressValue}
                onChange={setAddressValue}
                label="Street Address"
                placeholder="Start typing your address..."
              />

              {addressValue.street && (
                <div className="grid gap-4 md:grid-cols-3 pt-2">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">City</Label>
                    <div className="flex items-center gap-2 p-2 rounded bg-accent/50">
                      <p className="text-sm font-medium">{addressValue.city || "-"}</p>
                      {addressValue.status === "verified" && (
                        <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">State</Label>
                    <div className="flex items-center gap-2 p-2 rounded bg-accent/50">
                      <p className="text-sm font-medium">{addressValue.state || "-"}</p>
                      {addressValue.status === "verified" && (
                        <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">ZIP Code</Label>
                    <div className="flex items-center gap-2 p-2 rounded bg-accent/50">
                      <p className="text-sm font-medium">{addressValue.zip || "-"}</p>
                      {addressValue.status === "verified" && (
                        <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Email - Read Only Display */}
            <div className="space-y-2 p-4 rounded-lg bg-muted/50 border border-border/50">
              <Label className="text-sm text-muted-foreground">Email (cannot be edited)</Label>
              <p className="text-sm font-medium text-foreground">{patientAccount?.email || "Not available"}</p>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
