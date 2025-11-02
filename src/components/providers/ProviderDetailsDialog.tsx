import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Edit2, Save, X, Loader2 } from "lucide-react";
import { sanitizeEncrypted } from "@/lib/utils";
import { PhoneInput } from "@/components/ui/phone-input";
import { formatPhoneNumber, validateNPI, validateDEA } from "@/lib/validators";
import { verifyNPIDebounced } from "@/lib/npiVerification";

interface ProviderDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: any;
  onSuccess: () => void;
}

export const ProviderDetailsDialog = ({ 
  open, 
  onOpenChange, 
  provider, 
  onSuccess 
}: ProviderDetailsDialogProps) => {
  const { effectiveRole, effectiveUserId, effectivePracticeId } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [originalNpi, setOriginalNpi] = useState("");
  const [npiVerificationStatus, setNpiVerificationStatus] = useState<
    null | "verifying" | "verified" | "failed"
  >(null);
  const [formData, setFormData] = useState({
    fullName: provider.profiles?.full_name || (provider.profiles?.name?.includes('@') ? "" : provider.profiles?.name) || "",
    prescriberName: provider.profiles?.full_name || "",
    npi: sanitizeEncrypted(provider.profiles?.npi),
    dea: sanitizeEncrypted(provider.profiles?.dea),
    licenseNumber: sanitizeEncrypted(provider.profiles?.license_number),
    phone: provider.profiles?.phone ? provider.profiles.phone.replace(/\D/g, "") : "",
  });

  // Sync form data when provider changes to prevent cross-contamination
  useEffect(() => {
    const npiValue = sanitizeEncrypted(provider.profiles?.npi);
    setFormData({
      fullName: provider.profiles?.full_name || (provider.profiles?.name?.includes('@') ? "" : provider.profiles?.name) || "",
      prescriberName: provider.profiles?.full_name || "",
      npi: npiValue,
      dea: sanitizeEncrypted(provider.profiles?.dea),
      licenseNumber: sanitizeEncrypted(provider.profiles?.license_number),
      phone: provider.profiles?.phone ? provider.profiles.phone.replace(/\D/g, "") : "",
    });
    setOriginalNpi(npiValue);
    setNpiVerificationStatus(null);
    setIsEditing(false); // Reset editing state when provider changes
  }, [provider]);

  const isPractice = effectiveRole === "doctor" && (effectiveUserId === provider.practice_id || effectivePracticeId === provider.practice_id);
  const isOwnProvider = effectiveRole === "provider" && effectiveUserId === provider.user_id;
  const isAdmin = effectiveRole === "admin";
  const canViewCredentials = ['admin', 'doctor', 'provider', 'pharmacy'].includes(effectiveRole || '');

  const handleSave = async () => {
    setLoading(true);
    try {
      // Check NPI verification only if NPI was changed
      const npiChanged = formData.npi !== originalNpi;
      if (npiChanged && npiVerificationStatus !== "verified") {
        if (npiVerificationStatus === "verifying") {
          toast.error("Please wait for NPI verification to complete");
        } else {
          toast.error("NPI must be verified before saving changes");
        }
        setLoading(false);
        return;
      }

      // Validate no "[ENCRYPTED]" placeholders
      if (formData.npi === '[ENCRYPTED]' || formData.dea === '[ENCRYPTED]' || formData.licenseNumber === '[ENCRYPTED]') {
        toast.error("Please enter actual credential values, not [ENCRYPTED] placeholders");
        setLoading(false);
        return;
      }

      // Validate NPI format (required)
      if (!formData.npi || !formData.npi.trim()) {
        toast.error("Provider NPI is required");
        setLoading(false);
        return;
      }
      
      const npiResult = validateNPI(formData.npi);
      if (!npiResult.valid) {
        toast.error(`Invalid NPI: ${npiResult.error}`);
        setLoading(false);
        return;
      }

      // Validate DEA format if provided
      if (formData.dea && formData.dea.trim()) {
        const deaResult = validateDEA(formData.dea);
        if (!deaResult.valid) {
          toast.error(`Invalid DEA: ${deaResult.error}`);
          setLoading(false);
          return;
        }
      }

      // Update profiles table (where most provider data lives)
      const profileUpdateData: any = {};

      if (isOwnProvider) {
        // Providers can only update their phone
        profileUpdateData.phone = formData.phone || null;
      } else if (isPractice || isAdmin) {
        // Practices and admins can update everything
        profileUpdateData.full_name = formData.fullName;
        profileUpdateData.npi = formData.npi;
        profileUpdateData.dea = formData.dea || null; // Explicit null if empty
        profileUpdateData.license_number = formData.licenseNumber || null; // Explicit null if empty
        profileUpdateData.phone = formData.phone || null;
      }

      if (Object.keys(profileUpdateData).length > 0) {
        console.log('💾 Saving provider credentials to profiles table', {
          providerId: provider.id,
          userId: provider.user_id,
          updateFields: Object.keys(profileUpdateData)
        });

        const { data: updateData, error: profileError } = await supabase
          .from("profiles")
          .update(profileUpdateData)
          .eq("id", provider.user_id)
          .select();

        if (profileError) {
          console.error('❌ Profile update failed:', profileError);
          throw profileError;
        }

        console.log('✅ Profile updated successfully', { rowsAffected: updateData?.length });
      }

      // Update providers table timestamp
      const { error: providerError } = await supabase
        .from("providers" as any)
        .update({ updated_at: new Date().toISOString() })
        .eq("id", provider.id);

      if (providerError) {
        console.error('❌ Provider timestamp update failed:', providerError);
        throw providerError;
      }

      toast.success("Provider credentials updated successfully!");
      setIsEditing(false);
      onSuccess();
    } catch (error: any) {
      console.error('❌ Failed to update provider:', error);
      toast.error(error.message || "Failed to update provider. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Provider Details</DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant={provider.active ? "default" : "secondary"}>
                {provider.active ? "Active" : "Inactive"}
              </Badge>
              {!isEditing && (isPractice || isOwnProvider || isAdmin) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Practice</Label>
            <div className="p-2 bg-muted rounded-md">{provider.practice?.name || provider.practice?.company}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              {isEditing && (isPractice || isAdmin) ? (
                <Input
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                />
              ) : (
                <div className="p-2 bg-muted rounded-md">{provider.profiles?.full_name || (provider.profiles?.name?.includes('@') ? provider.profiles?.email : provider.profiles?.name) || provider.profiles?.email}</div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <div className="p-2 bg-muted rounded-md">{provider.profiles?.email}</div>
            </div>
          </div>

          {canViewCredentials && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Provider NPI #</Label>
                  {isEditing && (isPractice || isAdmin) ? (
                    <div className="space-y-1">
                      <Input
                        type="tel"
                        maxLength={10}
                        value={formData.npi}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          setFormData({ ...formData, npi: value });
                          
                          // Reset verification status when NPI changes
                          if (value.length !== 10) {
                            setNpiVerificationStatus(null);
                          } else if (value !== originalNpi) {
                            setNpiVerificationStatus("verifying");
                            
                            // Real-time NPI verification with timeout handling
                            const expectedNpi = value; // Capture current value
                            verifyNPIDebounced(value, (result) => {
                              setFormData(currentFormData => {
                                // Only apply result if NPI still matches expected value
                                if (currentFormData.npi === expectedNpi && expectedNpi === value) {
                                  if (result.valid && !result.error) {
                                    setNpiVerificationStatus("verified");
                                    if (result.providerName) {
                                      toast.success(`NPI Verified: ${result.providerName}${result.specialty ? ` - ${result.specialty}` : ''}`);
                                    } else {
                                      toast.success(`NPI ${result.npi} verified successfully${result.type ? ` (${result.type})` : ''}`);
                                    }
                                  } else {
                                    // Failed or has error
                                    setNpiVerificationStatus("failed");
                                    toast.error(result.error || "NPI verification failed");
                                  }
                                }
                                return currentFormData;
                              });
                            });
                          } else {
                            // NPI unchanged - no verification needed
                            setNpiVerificationStatus(null);
                          }
                        }}
                        placeholder="1234567890"
                      />
                      {npiVerificationStatus === "verifying" && (
                        <p className="text-sm text-muted-foreground">🔄 Verifying NPI...</p>
                      )}
                      {npiVerificationStatus === "verified" && (
                        <p className="text-sm text-green-600">✅ NPI Verified</p>
                      )}
                      {npiVerificationStatus === "failed" && (
                        <p className="text-sm text-destructive">❌ Invalid NPI</p>
                      )}
                    </div>
                  ) : (
                    <div className="p-2 bg-muted rounded-md">
                      {sanitizeEncrypted(provider.profiles?.npi) || "Not set"}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Provider DEA #</Label>
                  {isEditing && (isPractice || isAdmin) ? (
                    <div className="space-y-1">
                      <Input
                        type="text"
                        maxLength={9}
                        value={formData.dea}
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
                          setFormData({ ...formData, dea: value });
                        }}
                        placeholder="AB1234567"
                      />
                    </div>
                  ) : (
                    <div className="p-2 bg-muted rounded-md">
                      {sanitizeEncrypted(provider.profiles?.dea) || "Not set"}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>License Number</Label>
                {isEditing && (isPractice || isAdmin) ? (
                  <div className="space-y-1">
                    <Input
                      value={formData.licenseNumber}
                      onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                      placeholder="Enter license number"
                    />
                  </div>
                ) : (
                  <div className="p-2 bg-muted rounded-md">
                    {sanitizeEncrypted(provider.profiles?.license_number) || "Not set"}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Phone</Label>
            {isEditing ? (
              <PhoneInput
                value={formData.phone}
                onChange={(phone) => setFormData({ ...formData, phone })}
                placeholder="(555) 123-4567"
              />
            ) : (
              <div className="p-2 bg-muted rounded-md">{formatPhoneNumber(provider.profiles?.phone)}</div>
            )}
          </div>

          {isEditing && (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  const npiValue = sanitizeEncrypted(provider.profiles?.npi);
                  setFormData({
                    fullName: provider.profiles?.full_name || (provider.profiles?.name?.includes('@') ? "" : provider.profiles?.name) || "",
                    prescriberName: provider.profiles?.full_name || "",
                    npi: npiValue,
                    dea: sanitizeEncrypted(provider.profiles?.dea),
                    licenseNumber: sanitizeEncrypted(provider.profiles?.license_number),
                    phone: provider.profiles?.phone ? provider.profiles.phone.replace(/\D/g, "") : "",
                  });
                  setOriginalNpi(npiValue);
                  setNpiVerificationStatus(null);
                }}
                disabled={loading}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
