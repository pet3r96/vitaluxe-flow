import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const TwoFactorToggle = () => {
  const queryClient = useQueryClient();

  // Fetch current 2FA enforcement setting
  const { data: setting, isLoading } = useQuery({
    queryKey: ["twoFAEnforcement"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", "two_fa_enforcement_enabled")
        .single();

      if (error) throw error;
      return data.setting_value === "true";
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from("system_settings")
        .update({ setting_value: enabled ? "true" : "false", updated_at: new Date().toISOString() })
        .eq("setting_key", "two_fa_enforcement_enabled");

      if (error) throw error;
    },
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["twoFAEnforcement"] });
      toast.success(
        enabled
          ? "2FA enforcement enabled for all users"
          : "2FA enforcement disabled for all users"
      );
    },
    onError: (error) => {
      console.error("Error updating 2FA enforcement:", error);
      toast.error("Failed to update 2FA enforcement setting");
    },
  });

  const handleToggle = (checked: boolean) => {
    updateMutation.mutate(checked);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Two-Factor Authentication Enforcement</CardTitle>
          <CardDescription>
            Control whether 2FA is required for all users during development
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const isEnabled = setting ?? true;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-Factor Authentication Enforcement</CardTitle>
        <CardDescription>
          Control whether 2FA is required for all users during development
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between space-x-4">
          <Label htmlFor="2fa-toggle" className="flex-1">
            <div className="font-medium">Enforce 2FA for All Users</div>
            <div className="text-sm text-muted-foreground">
              {isEnabled
                ? "Users will be required to set up and verify 2FA"
                : "Users can log in without 2FA (development mode)"}
            </div>
          </Label>
          <Switch
            id="2fa-toggle"
            checked={isEnabled}
            onCheckedChange={handleToggle}
            disabled={updateMutation.isPending}
          />
        </div>

        {isEnabled ? (
          <Alert className="border-green-500/50 bg-green-500/10">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-600">
              <strong>2FA Enabled:</strong> All users will be required to set up and verify
              two-factor authentication. This is the recommended setting for production.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-amber-500/50 bg-amber-500/10">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-600">
              <strong>2FA Disabled:</strong> Users can log in without two-factor authentication.
              This setting should only be used during development. Existing 2FA enrollments are
              preserved and will be enforced when this is re-enabled.
            </AlertDescription>
          </Alert>
        )}

        {updateMutation.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Updating setting...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
