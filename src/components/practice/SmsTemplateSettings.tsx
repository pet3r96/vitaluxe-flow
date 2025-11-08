import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RotateCcw } from "lucide-react";

interface SmsTemplateSettingsProps {
  practiceId: string;
}

const DEFAULT_TEMPLATES: Record<string, string> = {
  session_ready: `Your video appointment with {{provider_name}} is ready!

Portal Login: {{portal_link}}
Guest Access: {{guest_link}}

Guest link expires in 24 hours.

{{practice_name}}`,
  session_reminder: `Reminder: Your video appointment with {{provider_name}} is scheduled for tomorrow.

{{practice_name}}`,
  session_cancelled: `Your video appointment with {{provider_name}} has been cancelled.

{{practice_name}}`
};

const AVAILABLE_TOKENS: Record<string, { token: string; description: string }[]> = {
  session_ready: [
    { token: '{{provider_name}}', description: 'Provider\'s name' },
    { token: '{{patient_name}}', description: 'Patient\'s name' },
    { token: '{{portal_link}}', description: 'Portal login link' },
    { token: '{{guest_link}}', description: 'Guest access link' },
    { token: '{{practice_name}}', description: 'Practice name' }
  ],
  session_reminder: [
    { token: '{{provider_name}}', description: 'Provider\'s name' },
    { token: '{{patient_name}}', description: 'Patient\'s name' },
    { token: '{{practice_name}}', description: 'Practice name' }
  ],
  session_cancelled: [
    { token: '{{provider_name}}', description: 'Provider\'s name' },
    { token: '{{patient_name}}', description: 'Patient\'s name' },
    { token: '{{practice_name}}', description: 'Practice name' }
  ]
};

export const SmsTemplateSettings = ({ practiceId }: SmsTemplateSettingsProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<string>('session_ready');
  const [templateText, setTemplateText] = useState<string>('');

  const { data: templates, isLoading } = useQuery({
    queryKey: ['sms-templates', practiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('practice_sms_templates')
        .select('*')
        .eq('practice_id', practiceId);

      if (error) throw error;
      return data || [];
    }
  });

  // Update template text when templates or selectedType changes
  useEffect(() => {
    if (templates) {
      const currentTemplate = templates.find(t => t.template_type === selectedType);
      setTemplateText(currentTemplate?.message_template || DEFAULT_TEMPLATES[selectedType]);
    }
  }, [templates, selectedType]);

  const updateMutation = useMutation({
    mutationFn: async ({ templateType, messageTemplate }: { templateType: string; messageTemplate: string }) => {
      const { data, error } = await supabase.functions.invoke('update-practice-sms-template', {
        body: { templateType, messageTemplate, practiceId }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-templates', practiceId] });
      toast({
        title: "Template Updated",
        description: "SMS template has been saved successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update template",
        variant: "destructive"
      });
    }
  });

  const handleTemplateTypeChange = (type: string) => {
    setSelectedType(type);
    const currentTemplate = templates?.find(t => t.template_type === type);
    setTemplateText(currentTemplate?.message_template || DEFAULT_TEMPLATES[type]);
  };

  const handleResetToDefault = () => {
    setTemplateText(DEFAULT_TEMPLATES[selectedType]);
  };

  const handleSave = () => {
    updateMutation.mutate({
      templateType: selectedType,
      messageTemplate: templateText
    });
  };

  const insertToken = (token: string) => {
    setTemplateText(prev => prev + token);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>SMS Templates</CardTitle>
        <CardDescription>
          Customize SMS messages sent to patients for video appointments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Template Type</Label>
          <Select value={selectedType} onValueChange={handleTemplateTypeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="session_ready">Session Ready</SelectItem>
              <SelectItem value="session_reminder">Session Reminder</SelectItem>
              <SelectItem value="session_cancelled">Session Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Available Tokens</Label>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_TOKENS[selectedType]?.map(({ token, description }) => (
              <Button
                key={token}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertToken(token)}
                className="text-xs"
              >
                {token}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Click tokens to insert them at the cursor position
          </p>
        </div>

        <div className="space-y-2">
          <Label>Message Template</Label>
          <Textarea
            value={templateText}
            onChange={(e) => setTemplateText(e.target.value)}
            rows={10}
            placeholder="Enter your SMS message template..."
            className="font-mono text-sm"
          />
        </div>

        <div className="space-y-3">
          <Label>Preview</Label>
          <div className="p-4 bg-muted rounded-lg border">
            <p className="text-sm whitespace-pre-wrap">
              {templateText
                .replace('{{provider_name}}', 'Dr. Smith')
                .replace('{{patient_name}}', 'John Doe')
                .replace('{{portal_link}}', 'https://example.com/portal/session123')
                .replace('{{guest_link}}', 'https://example.com/guest/abc123')
                .replace('{{practice_name}}', 'VitaLuxe Healthcare')}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Template
          </Button>
          <Button
            variant="outline"
            onClick={handleResetToDefault}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Default
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};