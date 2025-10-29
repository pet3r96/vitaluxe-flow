import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Building2 } from "lucide-react";

interface NewMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function NewMessageDialog({ open, onOpenChange, onSuccess }: NewMessageDialogProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  // Get patient's practice info to display
  const { data: patientAccount } = useQuery({
    queryKey: ["patient-account"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("patient_accounts")
        .select("*, profiles!patient_accounts_practice_id_fkey(name, address_city, address_state)")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!message.trim()) throw new Error("Message is required");

      const { error } = await supabase.functions.invoke("send-patient-message", {
        body: {
          subject: subject.trim() || "Patient Message",
          message: message.trim(),
        },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Message sent to your practice");
      setSubject("");
      setMessage("");
      onSuccess();
    },
    onError: (error: any) => {
      const bodyError = error?.context?.body?.error || error?.context?.body?.message;
      const isNetwork = error?.name === 'FunctionsFetchError' || /Failed to send a request/i.test(error?.message ?? '');
      const msg = bodyError || (isNetwork ? "We couldn't reach the messaging service. Please try again in a moment." : (error?.message || "Failed to send message"));
      toast.error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
          <DialogDescription>
            Send a secure message to your healthcare practice
          </DialogDescription>
        </DialogHeader>

        {patientAccount?.profiles && (
          <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <Building2 className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-sm">Sending to:</p>
              <p className="text-sm text-muted-foreground">
                {patientAccount.profiles.name}
                {patientAccount.profiles.address_city && (
                  <> • {patientAccount.profiles.address_city}, {patientAccount.profiles.address_state}</>
                )}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What is this message about?"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here..."
              rows={6}
              required
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This message will be sent securely to your practice and their staff
            </p>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={sendMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!message.trim() || sendMutation.isPending}>
              {sendMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Message
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
