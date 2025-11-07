import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, RotateCcw, Mail, MessageSquare } from "lucide-react";

const EVENT_TYPES = [
  { value: "appointment_confirmed", label: "Appointment Confirmed" },
  { value: "appointment_reminder", label: "Appointment Reminder" },
  { value: "appointment_cancelled", label: "Appointment Cancelled" },
  { value: "appointment_rescheduled", label: "Appointment Rescheduled" },
  { value: "patient_message_received", label: "Patient Message Received" },
];

const COMMON_VARIABLES = [
  "{{first_name}}",
  "{{last_name}}",
  "{{date_time}}",
  "{{time}}",
  "{{provider_name}}",
  "{{practice_name}}",
  "{{practice_address}}",
];

export default function NotificationTemplates() {
  const { effectivePracticeId, effectiveRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedEvent, setSelectedEvent] = useState("appointment_confirmed");
  const [editMode, setEditMode] = useState<{ [key: string]: boolean }>({});

  const isAdmin = effectiveRole === "admin" || effectiveRole === "super_admin";

  const { data: templates, isLoading } = useQuery({
    queryKey: ["notification_templates", effectivePracticeId, selectedEvent],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("notification_templates")
        .select("*")
        .eq("event_type", selectedEvent)
        .or(`practice_id.eq.${effectivePracticeId},practice_id.is.null`);

      if (error) throw error;
      return data || [];
    },
    enabled: !!effectivePracticeId,
  });

  const saveMutation = useMutation({
    mutationFn: async (template: any) => {
      const { error } = await (supabase as any)
        .from("notification_templates")
        .upsert({
          ...template,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification_templates"] });
      toast({
        title: "Template saved",
        description: "Notification template updated successfully",
      });
      setEditMode({});
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save template",
        variant: "destructive",
      });
    },
  });

  const handleSave = (template: any) => {
    saveMutation.mutate(template);
  };

  const handleReset = async (channel: string) => {
    const { data: defaultTemplate } = await (supabase as any)
      .from("notification_templates")
      .select("*")
      .eq("event_type", selectedEvent)
      .eq("channel", channel)
      .is("practice_id", null)
      .single();

    if (defaultTemplate) {
      const practiceTemplate = (templates as any)?.find(
        (t: any) => t.channel === channel && t.practice_id === effectivePracticeId
      );

      if (practiceTemplate) {
        handleSave({
          ...practiceTemplate,
          message_template: defaultTemplate.message_template,
          subject: defaultTemplate.subject,
        });
      }
    }
  };

  const getTemplate = (channel: string) => {
    // First try practice-specific template
    const practiceTemplate = (templates as any)?.find(
      (t: any) => t.channel === channel && t.practice_id === effectivePracticeId
    );
    
    // Fall back to default template
    const defaultTemplate = (templates as any)?.find(
      (t: any) => t.channel === channel && t.practice_id === null
    );

    return practiceTemplate || defaultTemplate;
  };

  const TemplateEditor = ({ channel }: { channel: "sms" | "email" }) => {
    const template = getTemplate(channel);
    const isEditing = editMode[channel];
    const [localTemplate, setLocalTemplate] = useState((template as any)?.message_template || "");
    const [localSubject, setLocalSubject] = useState((template as any)?.subject || "");

    if (isLoading) {
      return <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>;
    }

    if (!template) {
      return <div className="text-muted-foreground">No template found for this event</div>;
    }

    const insertVariable = (variable: string) => {
      const textarea = document.getElementById(`template-${channel}`) as HTMLTextAreaElement;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);

      textarea.value = before + variable + after;
      textarea.selectionStart = textarea.selectionEnd = start + variable.length;
      textarea.focus();

      // Update local state
      setLocalTemplate(textarea.value);
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {channel === "email" ? <Mail className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
            <h3 className="text-lg font-semibold capitalize">{channel} Template</h3>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLocalTemplate((template as any).message_template);
                    setLocalSubject((template as any).subject || "");
                    setEditMode({ ...editMode, [channel]: false });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSave({
                    ...template,
                    practice_id: effectivePracticeId,
                    message_template: localTemplate,
                    subject: channel === "email" ? localSubject : null,
                  })}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <><Save className="h-4 w-4 mr-2" /> Save</>
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReset(channel)}
                  disabled={!isAdmin}
                >
                  <RotateCcw className="h-4 w-4 mr-2" /> Reset
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setLocalTemplate((template as any).message_template);
                    setLocalSubject((template as any).subject || "");
                    setEditMode({ ...editMode, [channel]: true });
                  }}
                  disabled={!isAdmin}
                >
                  Edit
                </Button>
              </>
            )}
          </div>
        </div>

        {channel === "email" && (
          <div>
            <label className="text-sm font-medium mb-2 block">Subject</label>
            <Input
              value={isEditing ? localSubject : (template as any).subject || ""}
              onChange={(e) => setLocalSubject(e.target.value)}
              disabled={!isEditing}
              placeholder="Email subject..."
            />
          </div>
        )}

        <div>
          <label className="text-sm font-medium mb-2 block">Message Template</label>
          <Textarea
            id={`template-${channel}`}
            value={isEditing ? localTemplate : (template as any).message_template}
            onChange={(e) => setLocalTemplate(e.target.value)}
            disabled={!isEditing}
            rows={8}
            className="font-mono text-sm"
          />
        </div>

        {isEditing && (
          <div>
            <p className="text-sm font-medium mb-2">Insert Variable</p>
            <div className="flex flex-wrap gap-2">
              {COMMON_VARIABLES.map((variable) => (
                <Badge
                  key={variable}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => insertVariable(variable)}
                >
                  {variable}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {(template as any).practice_id === null && (
          <div className="bg-muted p-3 rounded-md text-sm text-muted-foreground">
            This is a default system template. Edit to create a practice-specific override.
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Notification Templates</h1>
        <p className="text-muted-foreground">Customize notification messages for each event type</p>
      </div>

      <Tabs value={selectedEvent} onValueChange={setSelectedEvent}>
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full">
          {EVENT_TYPES.map((event) => (
            <TabsTrigger key={event.value} value={event.value}>
              {event.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {EVENT_TYPES.map((event) => (
          <TabsContent key={event.value} value={event.value} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>SMS Template</CardTitle>
                <CardDescription>Customize the SMS message for {event.label}</CardDescription>
              </CardHeader>
              <CardContent>
                <TemplateEditor channel="sms" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Email Template</CardTitle>
                <CardDescription>Customize the email message for {event.label}</CardDescription>
              </CardHeader>
              <CardContent>
                <TemplateEditor channel="email" />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
