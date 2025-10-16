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
import { logCredentialAccess } from "@/lib/auditLogger";

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
  const { effectiveRole, effectiveUserId } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [decryptedCreds, setDecryptedCreds] = useState<{ npi?: string; dea?: string; license_number?: string } | null>(null);
  const [isLoadingCreds, setIsLoadingCreds] = useState(false);
  const [formData, setFormData] = useState({
    fullName: provider.profiles?.full_name || provider.profiles?.name || "",
    prescriberName: provider.profiles?.full_name || "",
    npi: provider.profiles?.npi || "",
    dea: provider.profiles?.dea || "",
    licenseNumber: provider.profiles?.license_number || "",
    phone: provider.profiles?.phone || "",
  });

  const isPractice = effectiveRole === "doctor" && effectiveUserId === provider.practice_id;
  const isOwnProvider = effectiveRole === "provider" && effectiveUserId === provider.user_id;
  const isAdmin = effectiveRole === "admin";
  const canViewCredentials = ['admin', 'doctor', 'provider', 'pharmacy'].includes(effectiveRole || '');

  // Fetch and decrypt provider credentials when dialog opens (for authorized roles)
  useEffect(() => {
    const fetchDecryptedCredentials = async () => {
      if (!open || !provider?.id || !canViewCredentials) {
        setDecryptedCreds(null);
        return;
      }

      setIsLoadingCreds(true);
      try {
        const { data, error } = await supabase.rpc('get_decrypted_provider_credentials', {
          p_provider_id: provider.id
        });

        if (error) throw error;

        if (data && data.length > 0) {
          setDecryptedCreds(data[0]);

          // Log credential access
          const relationship = 
            isOwnProvider ? 'self' :
            isAdmin ? 'admin' :
            isPractice ? 'practice_admin' :
            effectiveRole === 'topline' ? 'topline' :
            'downline';

          await logCredentialAccess({
            profileId: provider.user_id,
            profileName: provider.profiles?.full_name || provider.profiles?.name || 'Unknown',
            accessedFields: {
              npi: !!data[0].npi,
              dea: !!data[0].dea,
              license: !!data[0].license_number,
            },
            viewerRole: effectiveRole || 'unknown',
            relationship,
            componentContext: 'ProviderDetailsDialog'
          });
        }
      } catch (error) {
        console.error('Failed to decrypt provider credentials:', error);
        setDecryptedCreds(null);
      } finally {
        setIsLoadingCreds(false);
      }
    };

    fetchDecryptedCredentials();
  }, [open, provider?.id, canViewCredentials, effectiveRole, isOwnProvider, isPractice, isAdmin]);

  const handleSave = async () => {
    setLoading(true);
    try {
      // Validate no "[ENCRYPTED]" placeholders
      if (formData.npi === '[ENCRYPTED]' || formData.dea === '[ENCRYPTED]' || formData.licenseNumber === '[ENCRYPTED]') {
        toast.error("Please enter actual credential values, not [ENCRYPTED] placeholders");
        setLoading(false);
        return;
      }

      // Update profiles table (where most provider data lives)
      const profileUpdateData: any = {};

      if (isOwnProvider) {
        // Providers can only update their phone
        profileUpdateData.phone = formData.phone;
      } else if (isPractice || isAdmin) {
        // Practices and admins can update everything
        profileUpdateData.full_name = formData.fullName;
        profileUpdateData.npi = formData.npi;
        profileUpdateData.dea = formData.dea;
        profileUpdateData.license_number = formData.licenseNumber;
        profileUpdateData.phone = formData.phone;
      }

      if (Object.keys(profileUpdateData).length > 0) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update(profileUpdateData)
          .eq("id", provider.user_id);

        if (profileError) throw profileError;
      }

      // Update providers table timestamp
      const { error: providerError } = await supabase
        .from("providers" as any)
        .update({ updated_at: new Date().toISOString() })
        .eq("id", provider.id);

      if (providerError) throw providerError;

      toast.success("Provider updated successfully");
      setIsEditing(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Failed to update provider");
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
                <div className="p-2 bg-muted rounded-md">{provider.profiles?.full_name || provider.profiles?.name}</div>
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
                    <Input
                      value={formData.npi}
                      onChange={(e) => setFormData({ ...formData, npi: e.target.value })}
                    />
                  ) : (
                    <div className="p-2 bg-muted rounded-md flex items-center gap-2">
                      {isLoadingCreds ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span className="text-sm text-muted-foreground">Decrypting...</span>
                        </>
                      ) : decryptedCreds?.npi || "N/A"}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Provider DEA #</Label>
                  {isEditing && (isPractice || isAdmin) ? (
                    <Input
                      value={formData.dea}
                      onChange={(e) => setFormData({ ...formData, dea: e.target.value })}
                    />
                  ) : (
                    <div className="p-2 bg-muted rounded-md flex items-center gap-2">
                      {isLoadingCreds ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span className="text-sm text-muted-foreground">Decrypting...</span>
                        </>
                      ) : decryptedCreds?.dea || "N/A"}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>License Number</Label>
                {isEditing && (isPractice || isAdmin) ? (
                  <Input
                    value={formData.licenseNumber}
                    onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                  />
                ) : (
                  <div className="p-2 bg-muted rounded-md flex items-center gap-2">
                    {isLoadingCreds ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="text-sm text-muted-foreground">Decrypting...</span>
                      </>
                    ) : decryptedCreds?.license_number || "N/A"}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Phone</Label>
            {isEditing ? (
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            ) : (
              <div className="p-2 bg-muted rounded-md">{provider.profiles?.phone || "N/A"}</div>
            )}
          </div>

          {isEditing && (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  setFormData({
                    fullName: provider.profiles?.full_name || provider.profiles?.name || "",
                    prescriberName: provider.profiles?.full_name || "",
                    npi: provider.profiles?.npi || "",
                    dea: provider.profiles?.dea || "",
                    licenseNumber: provider.profiles?.license_number || "",
                    phone: provider.profiles?.phone || "",
                  });
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
