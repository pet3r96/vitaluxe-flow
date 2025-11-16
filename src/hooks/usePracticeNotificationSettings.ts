import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PracticeNotificationSettings {
  enable_email_notifications: boolean;
  enable_sms_notifications: boolean;
}

export function usePracticeNotificationSettings(practiceId: string | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ["practice-notification-settings", practiceId],
    queryFn: async () => {
      if (!practiceId) return null;

      const { data, error } = await supabase
        .from("practice_automation_settings")
        .select("enable_email_notifications, enable_sms_notifications")
        .eq("practice_id", practiceId)
        .single();

      if (error) throw error;
      
      // Default to true if columns are null
      return {
        enable_email_notifications: data?.enable_email_notifications ?? true,
        enable_sms_notifications: data?.enable_sms_notifications ?? true,
      };
    },
    enabled: !!practiceId,
  });

  const updateSettings = useMutation({
    mutationFn: async (newSettings: PracticeNotificationSettings) => {
      if (!practiceId) throw new Error("Practice ID is required");

      const { data, error } = await supabase
        .from("practice_automation_settings")
        .upsert({
          practice_id: practiceId,
          enable_email_notifications: newSettings.enable_email_notifications,
          enable_sms_notifications: newSettings.enable_sms_notifications,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["practice-notification-settings", practiceId] });
      toast({
        title: "Success",
        description: "Notification settings updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update settings: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
    },
  });

  return {
    settings,
    isLoading,
    error,
    updateSettings: updateSettings.mutate,
    isUpdating: updateSettings.isPending,
  };
}
