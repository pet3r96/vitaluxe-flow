import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Users } from "lucide-react";
import { sendNotification } from "@/lib/notifications";

const EVENT_TYPES = [
  { value: "system_announcement", label: "System Announcement" },
  { value: "practice_update", label: "Practice Update" },
  { value: "promotional", label: "Promotional" },
  { value: "reminder", label: "General Reminder" },
];

export default function BulkNotifications() {
  const { effectivePracticeId, effectiveRole } = useAuth();
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [filters, setFilters] = useState({
    role: "all",
    practice: effectivePracticeId || "all",
  });
  const [notification, setNotification] = useState({
    eventType: "system_announcement",
    title: "",
    message: "",
    sendEmail: true,
    sendSms: false,
  });

  const isAdmin = effectiveRole === "admin" || effectiveRole === "super_admin";

  // Fetch recipient count based on filters
  const { data: recipientCount, isLoading: countLoading } = useQuery({
    queryKey: ["bulk_notification_recipients", filters],
    queryFn: async () => {
      let query = (supabase as any).from("profiles").select("id", { count: "exact", head: true });

      if (filters.role !== "all") {
        query = query.eq("role", filters.role);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
  });

  // Fetch practices for filter
  const { data: practices } = useQuery({
    queryKey: ["practices_for_bulk"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("practices")
        .select("id, practice_name")
        .order("practice_name");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const handleSend = async () => {
    if (!notification.title || !notification.message) {
      toast({
        title: "Missing information",
        description: "Please provide both title and message",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      // Fetch recipients based on filters
      let query = (supabase as any).from("profiles").select("id");

      if (filters.role !== "all") {
        query = query.eq("role", filters.role);
      }

      const { data: recipients, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      if (!recipients || recipients.length === 0) {
        toast({
          title: "No recipients",
          description: "No users match the selected filters",
          variant: "destructive",
        });
        setSending(false);
        return;
      }

      // Send notifications in batches
      const batchSize = 50;
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);
        const promises = batch.map((recipient: any) =>
          sendNotification({
            userId: recipient.id,
            practiceId: effectivePracticeId,
            eventType: notification.eventType,
            title: notification.title,
            message: notification.message,
            sendEmail: notification.sendEmail,
            sendSms: notification.sendSms,
          })
            .then(() => successCount++)
            .catch((err) => {
              console.error("Failed to send to", recipient.id, err);
              errorCount++;
            })
        );

        await Promise.all(promises);
      }

      toast({
        title: "Bulk notification sent",
        description: `Successfully sent to ${successCount} recipients${errorCount > 0 ? `, ${errorCount} failed` : ""}`,
      });

      // Reset form
      setNotification({
        eventType: "system_announcement",
        title: "",
        message: "",
        sendEmail: true,
        sendSms: false,
      });
    } catch (error) {
      console.error("Bulk notification error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send bulk notification",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">This feature is only available to administrators</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Bulk Notifications</h1>
        <p className="text-sm text-muted-foreground">Send notifications to multiple users at once</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Notification Content</CardTitle>
            <CardDescription>Compose your notification message</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="eventType">Event Type</Label>
              <Select
                value={notification.eventType}
                onValueChange={(value) => setNotification({ ...notification, eventType: value })}
              >
                <SelectTrigger id="eventType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={notification.title}
                onChange={(e) => setNotification({ ...notification, title: e.target.value })}
                placeholder="Notification title..."
              />
            </div>

            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={notification.message}
                onChange={(e) => setNotification({ ...notification, message: e.target.value })}
                placeholder="Notification message..."
                rows={6}
              />
            </div>

            <div className="space-y-3">
              <Label>Delivery Channels</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sendEmail"
                  checked={notification.sendEmail}
                  onCheckedChange={(checked) =>
                    setNotification({ ...notification, sendEmail: checked as boolean })
                  }
                />
                <label
                  htmlFor="sendEmail"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Send Email
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sendSms"
                  checked={notification.sendSms}
                  onCheckedChange={(checked) =>
                    setNotification({ ...notification, sendSms: checked as boolean })
                  }
                />
                <label
                  htmlFor="sendSms"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Send SMS
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Recipient Filters
              </CardTitle>
              <CardDescription>Select who will receive this notification</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="roleFilter">User Role</Label>
                <Select
                  value={filters.role}
                  onValueChange={(value) => setFilters({ ...filters, role: value })}
                >
                  <SelectTrigger id="roleFilter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="patient">Patients</SelectItem>
                    <SelectItem value="provider">Providers</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="admin">Admins</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="practiceFilter">Practice</Label>
                <Select
                  value={filters.practice}
                  onValueChange={(value) => setFilters({ ...filters, practice: value })}
                >
                  <SelectTrigger id="practiceFilter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Practices</SelectItem>
                    {practices?.map((practice) => (
                      <SelectItem key={practice.id} value={practice.id}>
                        {practice.practice_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Recipient Count:</span>
                  {countLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Badge variant="secondary" className="text-lg px-3 py-1">
                      {recipientCount || 0}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={handleSend}
            disabled={sending || !recipientCount || countLoading}
            className="w-full"
            size="lg"
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Send className="h-5 w-5 mr-2" />
                Send to {recipientCount || 0} Recipients
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
