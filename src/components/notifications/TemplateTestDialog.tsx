import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface TemplateTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventType: string;
  channel: "sms" | "email";
}

export function TemplateTestDialog({ open, onOpenChange, eventType, channel }: TemplateTestDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [testData, setTestData] = useState({
    first_name: "John",
    last_name: "Doe",
    date_time: new Date().toISOString(),
    provider_name: "Dr. Smith",
    practice_name: "Vitaluxe Services",
  });

  const handleSendTest = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to send test notifications",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Create test notification
      const { data: notification, error: notificationError } = await supabase
        .from("notifications")
        .insert([{
          user_id: user.id,
          notification_type: eventType as any,
          title: `[TEST] ${eventType.replace(/_/g, " ")}`,
          message: "This is a test notification",
          metadata: testData,
          severity: 'info' as any,
        }])
        .select()
        .single();

      if (notificationError) throw notificationError;

      // Send via appropriate channel
      const { error: sendError } = await supabase.functions.invoke("send-notification", {
        body: {
          notification_id: notification.id,
          send_email: channel === "email",
          send_sms: channel === "sms",
        },
      });

      if (sendError) throw sendError;

      toast({
        title: "Test sent!",
        description: `Test ${channel} notification sent successfully to your account`,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Test notification error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send test notification",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Test {channel.toUpperCase()} Template</DialogTitle>
          <DialogDescription>
            Send a test {channel} notification to your account with sample data
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                value={testData.first_name}
                onChange={(e) => setTestData({ ...testData, first_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                value={testData.last_name}
                onChange={(e) => setTestData({ ...testData, last_name: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="provider_name">Provider Name</Label>
            <Input
              id="provider_name"
              value={testData.provider_name}
              onChange={(e) => setTestData({ ...testData, provider_name: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="practice_name">Practice Name</Label>
            <Input
              id="practice_name"
              value={testData.practice_name}
              onChange={(e) => setTestData({ ...testData, practice_name: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="date_time">Date & Time</Label>
            <Input
              id="date_time"
              type="datetime-local"
              value={testData.date_time.slice(0, 16)}
              onChange={(e) => setTestData({ ...testData, date_time: new Date(e.target.value).toISOString() })}
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendTest} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Test
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
