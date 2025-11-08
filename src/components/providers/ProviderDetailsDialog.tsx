import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [originalNpi, setOriginalNpi] = useState("");
  const [npiVerificationStatus, setNpiVerificationStatus] = useState<
    null | "verifying" | "verified" | "failed"
  >(null);
  const [formData, setFormData] = useState({
    fullName: "",
    prescriberName: "",
    npi: "",
    dea: "",
    licenseNumber: "",
    phone: "",
  });
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(false);

  // Load credentials with plaintext-first approach - only decrypt if field is "[ENCRYPTED]"
  useEffect(() => {
    const loadCredentialsPlaintextFirst = async () => {
      if (!provider?.user_id) {
        console.warn('[ProviderDetailsDialog] No provider.user_id, skipping load');
        return;
      }
      
      // CRITICAL: Reset editing state immediately to prevent stale data
      setIsEditing(false);
      setNpiVerificationStatus(null);
      setIsLoadingCredentials(true);
      
      try {
        console.log('[ProviderDetailsDialog] 🔄 Loading credentials (plaintext-first) for provider:', {
          providerId: provider.id,
          userId: provider.user_id,
          currentName: provider.profiles?.full_name || provider.prescriber_name
        });
        
        // STEP 1: Read plaintext values from profiles first
        const profiles = provider.profiles || {};
        const plaintextName = profiles.full_name || profiles.prescriber_name || provider.prescriber_name || "";
        const plaintextNpi = profiles.npi || "";
        const plaintextDea = profiles.dea || "";
        const plaintextLicense = profiles.license_number || "";
        const plaintextPhone = (profiles.phone || "").replace(/\D/g, '');
        
        // STEP 2: Check if any credential fields are "[ENCRYPTED]" - only decrypt those
        const needsDecryption = 
          plaintextNpi === "[ENCRYPTED]" || 
          plaintextDea === "[ENCRYPTED]" || 
          plaintextLicense === "[ENCRYPTED]" ||
          plaintextPhone === "[ENCRYPTED]";
        
        let decryptedData: any = null;
        
        if (needsDecryption) {
          console.log('[ProviderDetailsDialog] 🔐 Some fields are [ENCRYPTED], decrypting...');
          const { data: rpcData, error: rpcError } = await supabase.rpc('get_decrypted_profile_credentials', {
            p_user_id: provider.user_id
          });
          
          if (rpcError) {
            console.error('[ProviderDetailsDialog] RPC error during decryption:', rpcError);
          } else {
            decryptedData = rpcData?.[0];
          }
        }
        
        // STEP 3: Build final form data - use plaintext unless it's "[ENCRYPTED]", then use decrypted
        const finalName = plaintextName && plaintextName !== "[ENCRYPTED]" 
          ? plaintextName 
          : (decryptedData?.full_name || "");
        
        const finalNpi = plaintextNpi && plaintextNpi !== "[ENCRYPTED]" 
          ? plaintextNpi 
          : (decryptedData?.npi || "");
        
        const finalDea = plaintextDea && plaintextDea !== "[ENCRYPTED]" 
          ? plaintextDea 
          : (decryptedData?.dea || "");
        
        const finalLicense = plaintextLicense && plaintextLicense !== "[ENCRYPTED]" 
          ? plaintextLicense 
          : (decryptedData?.license_number || "");
        
        const finalPhone = plaintextPhone && plaintextPhone !== "[ENCRYPTED]" 
          ? plaintextPhone 
          : ((decryptedData?.phone || "").replace(/\D/g, ''));
        
        const newFormData = {
          fullName: finalName,
          prescriberName: finalName, // Always sync with fullName
          npi: finalNpi,
          dea: finalDea,
          licenseNumber: finalLicense,
          phone: finalPhone,
        };
        
        console.log('[ProviderDetailsDialog] ✅ Loaded credentials (plaintext-first):', {
          name: finalName,
          hasNPI: !!finalNpi,
          hasDEA: !!finalDea,
          decryptedFields: needsDecryption ? 'some' : 'none'
        });
        
        setFormData(newFormData);
        setOriginalNpi(finalNpi);
        
      } catch (error) {
        console.error('[ProviderDetailsDialog] ❌ Failed to load credentials:', error);
        
        // Ultimate fallback - use only plaintext, no decryption
        const profiles = provider.profiles || {};
        const fallbackName = profiles.full_name || profiles.prescriber_name || provider.prescriber_name || "";
        const fallbackNpi = profiles.npi === "[ENCRYPTED]" ? "" : (profiles.npi || "");
        
        setFormData({
          fullName: fallbackName,
          prescriberName: fallbackName,
          npi: fallbackNpi,
          dea: profiles.dea === "[ENCRYPTED]" ? "" : (profiles.dea || ""),
          licenseNumber: profiles.license_number === "[ENCRYPTED]" ? "" : (profiles.license_number || ""),
          phone: (profiles.phone === "[ENCRYPTED]" ? "" : (profiles.phone || "")).replace(/\D/g, ''),
        });
        setOriginalNpi(fallbackNpi);
      } finally {
        setIsLoadingCredentials(false);
      }
    };

    loadCredentialsPlaintextFirst();
  }, [provider?.id, provider?.user_id]); // Depend on IDs to ensure reload on provider change

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

      // CRITICAL: Build update payload - OVERWRITE existing values, don't merge
      const profileUpdateData: any = {};

      if (isOwnProvider) {
        // Providers can only update their phone
        profileUpdateData.phone = formData.phone || null;
      } else if (isPractice || isAdmin) {
        // Practices and admins can update everything
        // CRITICAL: Update BOTH full_name AND prescriber_name atomically to prevent display inconsistencies
        profileUpdateData.full_name = formData.fullName.trim();
        profileUpdateData.prescriber_name = formData.fullName.trim(); // Must match full_name exactly
        profileUpdateData.npi = formData.npi.trim();
        profileUpdateData.dea = formData.dea?.trim() || null; // Explicit null if empty
        profileUpdateData.license_number = formData.licenseNumber?.trim() || null; // Explicit null if empty
        profileUpdateData.phone = formData.phone?.trim() || null;
      }

      if (Object.keys(profileUpdateData).length > 0) {
        console.info('💾 [ProviderDetailsDialog] Saving provider - OVERWRITING existing data', {
          providerId: provider.id,
          userId: provider.user_id,
          updateFields: Object.keys(profileUpdateData),
          beforeName: provider.profiles?.full_name || provider.prescriber_name,
          afterName: profileUpdateData.full_name,
          beforeNPI: provider.profiles?.npi,
          afterNPI: profileUpdateData.npi
        });

        // ATOMIC UPDATE: Single query to overwrite all fields at once
        const { data: updateData, error: profileError } = await supabase
          .from("profiles")
          .update(profileUpdateData)
          .eq("id", provider.user_id)
          .select('id, full_name, prescriber_name, npi, dea, license_number, phone');

        if (profileError) {
          console.error('❌ [ProviderDetailsDialog] Profile update failed:', profileError);
          throw profileError;
        }

        console.info('✅ [ProviderDetailsDialog] Profile updated - verify changes:', { 
          rowsAffected: updateData?.length,
          updatedData: updateData?.[0]
        });
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

      // CRITICAL: Update local state immediately to prevent reversion on next render
      console.log('🔄 [ProviderDetailsDialog] Updating local state with saved values...');
      setFormData({
        ...formData,
        fullName: profileUpdateData.full_name || formData.fullName,
        prescriberName: profileUpdateData.prescriber_name || formData.prescriberName,
        npi: profileUpdateData.npi || formData.npi,
        dea: profileUpdateData.dea || formData.dea || "",
        licenseNumber: profileUpdateData.license_number || formData.licenseNumber || "",
        phone: profileUpdateData.phone || formData.phone || "",
      });
      setOriginalNpi(profileUpdateData.npi || formData.npi);
      
      // CRITICAL: Optimistically update ALL provider caches immediately for instant UI feedback
      console.log('🔄 [ProviderDetailsDialog] Optimistically updating provider caches...');
      
      // Update all active 'providers' queries with the new data
      queryClient.setQueriesData({ queryKey: ['providers'] }, (oldData: any) => {
        if (!oldData) return oldData;
        
        // Handle both array and object responses
        const providersList = Array.isArray(oldData) ? oldData : oldData.providers || [];
        
        const updatedList = providersList.map((p: any) => {
          if (p.id === provider.id || p.user_id === provider.user_id) {
            return {
              ...p,
              profiles: {
                ...p.profiles,
                ...profileUpdateData
              }
            };
          }
          return p;
        });
        
        return Array.isArray(oldData) ? updatedList : { ...oldData, providers: updatedList };
      });
      
      // Then invalidate caches and refetch in background
      console.log('🔄 [ProviderDetailsDialog] Invalidating caches for practice:', effectivePracticeId);
      
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['practice-rx-privileges'] }),
        queryClient.invalidateQueries({ queryKey: ['providers'] }),
        queryClient.invalidateQueries({ queryKey: ['calendar-data'] }),
        queryClient.invalidateQueries({ queryKey: ['patient_appointments'] }),
        queryClient.invalidateQueries({ queryKey: ['video-sessions'] })
      ]);
      
      toast.success("Provider updated successfully!", {
        description: `${formData.fullName} - NPI: ${formData.npi}`
      });
      
      console.log('✅ [ProviderDetailsDialog] Save complete, cache refreshed');
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
                <div className="space-y-1">
                  <Input
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Displayed on calendars, appointments, and documents
                  </p>
                </div>
              ) : (
                <div className="p-2 bg-muted rounded-md">
                  {formData.fullName || 'Not Set'}
                </div>
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
                      {formData.npi || "Not set"}
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
                      {formData.dea || "Not set"}
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
                    {formData.licenseNumber || "Not set"}
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
              <div className="p-2 bg-muted rounded-md">{formatPhoneNumber(formData.phone)}</div>
            )}
          </div>

          {isEditing && (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  setIsEditing(false);
                  // Reload credentials on cancel using plaintext-first approach
                  if (!provider.user_id) return;
                  
                  try {
                    // STEP 1: Read plaintext values from profiles first
                    const profiles = provider.profiles || {};
                    const plaintextName = profiles.full_name || profiles.prescriber_name || provider.prescriber_name || "";
                    const plaintextNpi = profiles.npi || "";
                    const plaintextDea = profiles.dea || "";
                    const plaintextLicense = profiles.license_number || "";
                    const plaintextPhone = (profiles.phone || "").replace(/\D/g, '');
                    
                    // STEP 2: Check if any credential fields are "[ENCRYPTED]" - only decrypt those
                    const needsDecryption = 
                      plaintextNpi === "[ENCRYPTED]" || 
                      plaintextDea === "[ENCRYPTED]" || 
                      plaintextLicense === "[ENCRYPTED]" ||
                      plaintextPhone === "[ENCRYPTED]";
                    
                    let decryptedData: any = null;
                    
                    if (needsDecryption) {
                      const { data, error } = await supabase.rpc('get_decrypted_profile_credentials', {
                        p_user_id: provider.user_id
                      });
                      if (error) throw error;
                      decryptedData = data?.[0];
                    }
                    
                    // STEP 3: Build final form data - use plaintext unless it's "[ENCRYPTED]", then use decrypted
                    const finalName = plaintextName && plaintextName !== "[ENCRYPTED]" 
                      ? plaintextName 
                      : (decryptedData?.full_name || "");
                    
                    const finalNpi = plaintextNpi && plaintextNpi !== "[ENCRYPTED]" 
                      ? plaintextNpi 
                      : (decryptedData?.npi || "");
                    
                    const finalDea = plaintextDea && plaintextDea !== "[ENCRYPTED]" 
                      ? plaintextDea 
                      : (decryptedData?.dea || "");
                    
                    const finalLicense = plaintextLicense && plaintextLicense !== "[ENCRYPTED]" 
                      ? plaintextLicense 
                      : (decryptedData?.license_number || "");
                    
                    const finalPhone = plaintextPhone && plaintextPhone !== "[ENCRYPTED]" 
                      ? plaintextPhone 
                      : ((decryptedData?.phone || "").replace(/\D/g, ''));
                    
                    setFormData({
                      fullName: finalName,
                      prescriberName: finalName,
                      npi: finalNpi,
                      dea: finalDea,
                      licenseNumber: finalLicense,
                      phone: finalPhone,
                    });
                    setOriginalNpi(finalNpi);
                  } catch (error) {
                    console.error('Error reloading credentials:', error);
                  }
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
